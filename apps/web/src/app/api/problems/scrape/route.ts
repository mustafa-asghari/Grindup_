import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clickhouse, initClickHouse } from '@/lib/clickhouse';
import { getEmbedding } from '@/lib/openai';
import { v4 as uuidv4 } from 'uuid';

const LEETCODE_API_ENDPOINT = process.env.LEETCODE_API_URL || 'https://leetcode.com/graphql';

type ExtractedTestCase = {
    input: string;
    expectedOutput: string;
};

function decodeHtmlEntities(input: string): string {
    // Decode common named entities + numeric entities (decimal/hex).
    const named: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
    };

    return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, g1) => {
        if (!g1) return m;
        if (g1[0] === '#') {
            const isHex = g1[1]?.toLowerCase() === 'x';
            const numStr = isHex ? g1.slice(2) : g1.slice(1);
            const codePoint = Number.parseInt(numStr, isHex ? 16 : 10);
            if (!Number.isFinite(codePoint)) return m;
            try {
                return String.fromCodePoint(codePoint);
            } catch {
                return m;
            }
        }
        return named[g1] ?? m;
    });
}

function cleanPreInnerHtml(preInnerHtml: string): string {
    // Preserve newlines for better parsing; LeetCode often uses <br>.
    const withNewlines = preInnerHtml.replace(/<br\s*\/?>/gi, '\n');
    const withoutTags = withNewlines.replace(/<\/?[^>]+>/g, '');
    const decoded = decodeHtmlEntities(withoutTags);
    return decoded.replace(/\r\n/g, '\n').trim();
}

function normalizeInputAssignments(rawInput: string): string {
    // Runner expects executable assignment statements, not "a = 1, b = 2".
    // Convert top-level commas that separate assignments into ';'.
    const s = rawInput.replace(/\r\n/g, '\n').replace(/\n+/g, '; ').trim();

    let out = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    let braceDepth = 0;
    let quote: '"' | "'" | null = null;
    let escaped = false;

    const isTopLevel = () => bracketDepth === 0 && parenDepth === 0 && braceDepth === 0 && !quote;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i]!;

        if (quote) {
            out += ch;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'") {
            quote = ch;
            out += ch;
            continue;
        }

        if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);

        if (ch === ',' && isTopLevel()) {
            const rest = s.slice(i + 1);
            // Replace comma only if it looks like it separates "var = value" parts.
            if (/^\s*[A-Za-z_]\w*\s*=/.test(rest)) {
                out += ';';
                continue;
            }
        }

        out += ch;
    }

    // Normalize spacing around separators.
    return out
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .join('; ');
}

function extractTestCases(htmlContent: string): ExtractedTestCase[] {
    const cases: ExtractedTestCase[] = [];

    // Pull <pre> blocks (LeetCode examples typically live here).
    const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
    const preBlocks: string[] = [];

    for (let m = preRegex.exec(htmlContent); m; m = preRegex.exec(htmlContent)) {
        if (m[1]) preBlocks.push(m[1]);
    }

    // Parse Input/Output pairs from each <pre>.
    const ioRegex =
        /Input:\s*([\s\S]*?)\s*Output:\s*([\s\S]*?)(?=\n\s*(?:Explanation|Constraints|Example|Note|Follow-up)\b|$)/gi;

    for (const preInnerHtml of preBlocks) {
        const text = cleanPreInnerHtml(preInnerHtml);
        if (!/input\s*:/i.test(text) || !/output\s*:/i.test(text)) continue;

        ioRegex.lastIndex = 0;
        for (let m = ioRegex.exec(text); m; m = ioRegex.exec(text)) {
            const rawInput = (m[1] ?? '').trim();
            const rawOutput = (m[2] ?? '').trim();
            if (!rawInput || !rawOutput) continue;

            cases.push({
                input: normalizeInputAssignments(rawInput),
                expectedOutput: rawOutput,
            });
        }
    }

    // De-dupe identical cases (some problems repeat examples).
    const seen = new Set<string>();
    return cases.filter(tc => {
        const key = `${tc.input}|||${tc.expectedOutput}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function POST() {
    try {
        console.log("Starting LeetCode scrape with Vector Sync...");
        await initClickHouse();

        // Fetch all available problems - LeetCode has ~3000 problems as of 2024
        const scrapeLimit = Number.parseInt(process.env.SCRAPE_LIMIT || '10000', 10);
        const listQuery = `
          query problemsetQuestionList($limit: Int) {
            problemsetQuestionList: questionList(categorySlug: "", limit: $limit, skip: 0, filters: {}) {
              questions: data {
                titleSlug
              }
            }
          }
        `;

        const listRes = await fetch(LEETCODE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Referer': 'https://leetcode.com/problemset/',
                'Origin': 'https://leetcode.com',
                'x-csrftoken': 'sWFb2Dh5F7GQTxY2V65W3jeC3KVrXuHx',
                'Cookie': 'csrftoken=sWFb2Dh5F7GQTxY2V65W3jeC3KVrXuHx; _gid=GA1.2.98586575.1768348915; ip_check=(false, "203.15.37.206"); gr_user_id=1c979af2-90e7-4497-8d7f-968c1680032f; 87b5a3c3f1a55520_gr_session_id=37d15cc5-fb21-4431-9090-f7efaf283aaa; 87b5a3c3f1a55520_gr_session_id_sent_vst=37d15cc5-fb21-4431-9090-f7efaf283aaa; __stripe_mid=7ed4d143-164e-4bdf-a715-f7a11815f0af81e6e2; __stripe_sid=dc4d00ec-345d-45b0-b552-30781d14ba689183a5; INGRESSCOOKIE=0cefd9aec0432530940ee0aefcbb3bda|8e0876c7c1464cc0ac96bc2edceabd27; _gat=1; _ga=GA1.1.2112201869.1768348915; _ga_CDRWKZTDEX=GS2.1.s1768359318$o3$g1$t1768361313$j60$l0$h0'
            },
            body: JSON.stringify({ query: listQuery, variables: { limit: scrapeLimit } })
        });

        const listData = await listRes.json();

        if (listData.errors) {
            throw new Error(`LeetCode List Error: ${listData.errors[0].message}`);
        }
        if (!listData.data || !listData.data.problemsetQuestionList) {
            console.error("Invalid LeetCode Response:", JSON.stringify(listData));
            throw new Error(`LeetCode invalid response. Check logs or update cookies.`);
        }

        const slugs = listData.data.problemsetQuestionList.questions.map((q: any) => q.titleSlug);

        let count = 0;

        // 2. Fetch Details
        for (const slug of slugs) {
            const detailQuery = `
               query questionData($titleSlug: String!) {
                 question(titleSlug: $titleSlug) {
                   title
                   content
                   difficulty
                   stats
                   codeSnippets {
                     lang
                     code
                   }
                   hints
                   topicTags { name }
                 }
               }
             `;

            const detailRes = await fetch(LEETCODE_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': 'https://leetcode.com/problemset/',
                    'Origin': 'https://leetcode.com',
                    'x-csrftoken': 'sWFb2Dh5F7GQTxY2V65W3jeC3KVrXuHx',
                    'Cookie': 'csrftoken=sWFb2Dh5F7GQTxY2V65W3jeC3KVrXuHx; _gid=GA1.2.98586575.1768348915; ip_check=(false, "203.15.37.206"); gr_user_id=1c979af2-90e7-4497-8d7f-968c1680032f; 87b5a3c3f1a55520_gr_session_id=37d15cc5-fb21-4431-9090-f7efaf283aaa; 87b5a3c3f1a55520_gr_session_id_sent_vst=37d15cc5-fb21-4431-9090-f7efaf283aaa; __stripe_mid=7ed4d143-164e-4bdf-a715-f7a11815f0af81e6e2; __stripe_sid=dc4d00ec-345d-45b0-b552-30781d14ba689183a5; INGRESSCOOKIE=0cefd9aec0432530940ee0aefcbb3bda|8e0876c7c1464cc0ac96bc2edceabd27; _gat=1; _ga=GA1.1.2112201869.1768348915; _ga_CDRWKZTDEX=GS2.1.s1768359318$o3$g1$t1768361313$j60$l0$h0'
                },
                body: JSON.stringify({ query: detailQuery, variables: { titleSlug: slug } })
            });
            const detailData = await detailRes.json();
            if (detailData.errors) {
                continue; // Skip faulty problem
            }
            if (!detailData.data || !detailData.data.question) continue;

            const q = detailData.data.question;

            if (!q) continue;
            // Skip locked/premium problems or those with missing data
            if (!q.content || !q.codeSnippets) {
                console.log(`Skipping locked/incomplete problem: ${q.title}`);
                continue;
            }

            const difficulty = q.difficulty.toLowerCase();

            // Prepare JSON for extra fields
            const metaData = {
                codeSnippets: q.codeSnippets,
                stats: q.stats,
                hints: q.hints
            };

            // Postgres Upsert
            const existing = await prisma.problem.findFirst({
                where: { title: q.title },
                select: {
                    id: true,
                    _count: { select: { testCases: true } }
                }
            });
            let problemId = existing?.id;
            const existingTestCaseCount = existing?._count?.testCases ?? 0;

            if (existing) {
                await prisma.problem.update({
                    where: { id: existing.id },
                    data: {
                        description: q.content,
                        difficulty: difficulty as any,
                        constraints: metaData as any,
                    }
                });
            } else {
                const created = await prisma.problem.create({
                    data: {
                        id: uuidv4(),
                        title: q.title,
                        description: q.content,
                        difficulty: difficulty as any,
                        timeLimitMs: 2000,
                        memoryLimitKb: 256000,
                        constraints: metaData as any,
                        topics: {
                            create: q.topicTags.map((t: any) => ({
                                topic: {
                                    connectOrCreate: {
                                        where: { name: t.name },
                                        create: { id: uuidv4(), name: t.name, level: 'topic' }
                                    }
                                }
                            }))
                        }
                    }
                });
                problemId = created.id;
            }

            // Create test cases from examples (only if none exist yet)
            if (problemId && existingTestCaseCount === 0) {
                const extracted = extractTestCases(q.content);
                if (extracted.length > 0) {
                    await prisma.testCases.createMany({
                        data: extracted.map((tc, idx) => ({
                            id: uuidv4(),
                            problemId,
                            input: tc.input,
                            expectedOutput: tc.expectedOutput,
                            order: idx + 1,
                            isHidden: false,
                        })),
                    });
                } else {
                    console.warn(`[scrape] No testcases parsed for "${q.title}" (${slug})`);
                }
            }

            // ClickHouse Vector Insert
            const statsStr = q.stats ? JSON.parse(q.stats).totalAccepted : ""; // simplified stats
            const textToEmbed = `${q.title}. ${q.content}. Difficulty: ${difficulty}. ${statsStr}`;
            const embedding = await getEmbedding(textToEmbed);

            await clickhouse.insert({
                table: 'problems_vec',
                values: [{
                    id: problemId,
                    title: q.title,
                    content: q.content,
                    difficulty: difficulty,
                    embedding: embedding
                }],
                format: 'JSONEachRow'
            });

            count++;
        }

        return NextResponse.json({ success: true, count, message: `Synced ${count} problems to Postgres & ClickHouse` });
    } catch (e: any) {
        console.error("Scrape Error Details:", e);
        // Return JSON error even on 500 to help debugging
        return NextResponse.json({
            error: e.message || e.toString(),
            stack: e.stack
        }, { status: 500 });
    }
}
