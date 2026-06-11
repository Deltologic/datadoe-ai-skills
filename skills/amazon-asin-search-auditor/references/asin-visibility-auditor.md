# ASIN Visibility Analysis

Use this reference when the user asks for analysis, optimization, or audit work on a specific ASIN.

## Inputs

- A single ASIN from the user.
- The marketplace domain from the current auditor run.
- The location of the current run data.

If you are not given a single ASIN by the user, ask for it.

# Task
Analyze the search performance of that ASIN and review its visibility in Amazon search results, then provide actionable recommendations for improvement.

# Details
- We are working only on that one ASIN and only in the one specific Amazon marketplace.
- Start by analyzing the search performance data for that ASIN presented in the JSON files provided by the super agent.
- In addition to that, fetch raw listing data for that ASIN from DataDoe using the `amazon_listings_raw` source:
    - Save this data to file using the `exports_raw_url_get` tool from DataDoe, as the result may be large.
    - Use it to inspect all available listing content, including title, bullet points, description, A+ / enhanced content, images, and backend search term / generic keyword fields if available.
    - If raw listing data is unavailable, continue with the Amazon page and search result data, clearly mark which fields could not be assessed, and do not infer hidden fields.
    - If A+ / enhanced content, backend terms, images, or any other listing area is unavailable in the data, state that limitation in the report and base recommendations only on visible or fetched evidence.
- For context, fetch from DataDoe:
    - Profitability of that ASIN from the last 64 days aggregated by week. Use the `amazon_profit_by_sku_and_date` source.
    - Latest available data about this ASIN from the `amazon_child_product_search_performance_per_month` source.
- Use the built-in browser to gather insights on how users see that ASIN page and to get details about its competitors from search results.

# Output
- Start with easy-to-read conclusions before any detailed tables:
    - Overall rating for the ASIN.
    - 2-4 business conclusions written for a business user, focused on why the listing is or is not likely to rank and convert for relevant customer intents.
    - Up to 3 priority improvements, only if improvements are needed.
- After the conclusions and before the scoring table, add a short "Detected Customer Intents" section showing what the audit inferred from the listing, search terms, and competitors:
    - Product identity: what the product is.
    - Main use / job to be done: what the customer buys it to do.
    - Target customer: who the listing appears to serve.
    - Key use contexts: where, when, or with what the product is used.
    - Purchase motivation: the outcome or improvement the customer wants.
- Then present a table with details in the following scoring areas: Title, Bullet Points, Images & Visual Proof, Description / A+, Backend Search Terms.
- For each area, show the following columns:
    - Name of the area
    - Rating: number from 0 to 5 in 0.5 steps, where 5 is the best and 3 is neutral.
    - Details of the rating: 2-3 sentence business-oriented justification of the rating.
    - Recommendations: 2-3 sentence recommendations for improvement OR empty if no recommendations are needed or if other aspects are a priority right now.
- In the rating details, include the evidence used for the score:
    - For Title, reference the exact product type, use case, audience, or context phrases found or missing.
    - For Bullet Points, reference the concrete benefit, scenario, audience, compatibility, or occasion claims found or missing.
    - For Images & Visual Proof, reference what the visible images prove or fail to prove, such as use case, result, scale, compatibility, or audience fit.
    - For Description / A+, reference the broader context, lifestyle, motivation, use case, and differentiation content found or missing.
    - For Backend Search Terms, summarize the visible backend/generic keyword themes if available; if not available, state that the area could not be directly inspected.
- Base the area ratings only on listing relevance and intent coverage for COSMO / Rufus-style ranking. Do not score PPC budget, price, profitability, or ratings as listing quality areas. Use those metrics only to explain business impact and prioritization.
- Calculate the overall rating as a weighted average of assessed area ratings, rounded to the nearest 0.5:
    - Title: 25%
    - Bullet Points: 25%
    - Images & Visual Proof: 20%
    - Description / A+: 20%
    - Backend Search Terms: 10%
- If an area cannot be assessed because the data is unavailable, exclude its weight and redistribute that weight proportionally across the assessed areas. State which areas were excluded from the overall rating.
- Use the following scoring logic:
    - 5.0: the area clearly covers all relevant required intents in the right listing placement, uses specific customer language, and supports ranking without keyword stuffing.
    - 4.0: the area covers most important intents and is commercially useful, with only minor missing contexts or wording gaps.
    - 3.0: the area covers the basic product, function, or audience, but misses important intent variants, scenarios, or customer motivations.
    - 2.0: the area is materially incomplete for ranking because several important intents are missing or too generic.
    - 1.0: the area is very weak, vague, misleading, or mostly irrelevant to how customers search and evaluate the product.
    - 0.0: the area is available but has no useful relevance content for that scoring area.
    - Not assessed: the area is unavailable or cannot be inspected from the available data.
- Score each area against these COSMO / Rufus relation requirements:
    - `is_a`: what the product is; product type, category, and core nature.
    - `used_as`: the role the product plays for the customer.
    - `used_for_func`: the main functional benefit.
    - `used_to`: the concrete task the product is bought for.
    - `capable_of`: effects, outcomes, capabilities, and performance.
    - `used_for_aud`: the intended audience, age, user type, skill level, or segment.
    - `used_by`: the real user profile, profession, lifestyle, or user role.
    - `xIs_a`: the assumed customer state or type, such as beginner, professional, pet owner, or other relevant condition.
    - `xWant`: the end goal the customer wants to achieve.
    - `xInterested_in`: the interest or lifestyle behind the purchase, such as beauty, fitness, travel, home decor, baby care, or another category-relevant lifestyle.
    - `used_in_loc`: the place, room, environment, or setting where the product is used.
    - `used_in_body`: the body part or body zone where the product is used, when relevant.
    - `used_on`: when the product is used, such as season, time, occasion, or daily routine.
    - `used_for_eve`: the activity or occasion the product fits.
    - `used_with`: compatible products, accessories, bundles, or items used together with it.
- Apply those relation requirements to the listing areas as follows:
    - Title: should answer what the product is, what it is used for, and who it is for. Score coverage of `is_a`, `used_as`, `used_for_func`, plus the strongest 1-2 relevant contexts from `used_for_aud`, `used_in_loc`, and `used_in_body`.
    - Bullet Points: should explain how the product works, what result it gives, situations where it is useful, audience fit, compatibility, and seasonality / occasions. Score coverage of `used_for_func`, `capable_of`, `used_to`, `used_for_aud`, `used_by`, `xIs_a`, `used_with`, `used_on`, and `used_for_eve`.
    - Images & Visual Proof: should visually prove the product capability, result, use case, audience, compatibility, and context of use. Score whether images support `capable_of`, `used_to`, `used_for_aud`, `used_in_loc`, `used_in_body`, `used_for_eve`, and `used_with` where relevant.
    - Description / A+: should build broader use context, lifestyle fit, purchase motivation, why this product is the right choice, and additional use cases. Score coverage of `used_to`, `xWant`, `xInterested_in`, `used_by`, `used_for_eve`, `used_with`, and deeper explanation of `capable_of`.
    - Backend Search Terms: should cover synonyms, alternative tasks and applications, alternative use cases, place / season / occasion context, audience variants, and related terms not already present on the front end. Score coverage of synonyms and variants for `used_for_aud`, `used_to`, `used_in_loc`, `used_on`, `used_for_eve`, and `used_with`; if backend terms are not available in the data, mark this area as Not assessed and exclude it from the overall rating.
- At the end, add a table with up to 5 top competitors for that ASIN based on the search results. For each competitor show the following columns:
    - Name of the competitor
    - Price
    - URL
    - Competitor Score: how much that competitor is a threat to the ASIN. 0-5, where 5 is the most threatening. Base this on the competitor's search position, listing relevance under the same COSMO / Rufus relation model, and visible conversion proof such as price, rating, reviews, and image strength.
    - What we can learn from that competitor: 2-3 sentences about what we can learn from that competitor.

# Output Format
Output everything as a simple markdown document saved to a file. Print only the file location.

Use this markdown structure:

```markdown
# ASIN Visibility Audit: ASIN

## Conclusions
- Overall rating: X.X / 5
- Conclusion 1
- Conclusion 2
- Conclusion 3

## Priority Improvements
1. Improvement 1
2. Improvement 2
3. Improvement 3

## Detected Customer Intents
| Intent | Audit Finding | Evidence |
|---|---|---|
| Product identity | ... | ... |
| Main use / job to be done | ... | ... |
| Target customer | ... | ... |
| Key use contexts | ... | ... |
| Purchase motivation | ... | ... |

## Listing Relevance Score
| Area | Rating | Details of the rating | Recommendations |
|---|---:|---|---|
| Title | X.X | ... | ... |
| Bullet Points | X.X | ... | ... |
| Images & Visual Proof | X.X | ... | ... |
| Description / A+ | X.X | ... | ... |
| Backend Search Terms | X.X or Not assessed | ... | ... |

## Business Context
Summarize relevant search performance, profitability, PPC, price, rating, and review context only when it changes prioritization.

## Competitors
| Competitor | Price | URL | Competitor Score | What we can learn |
|---|---:|---|---:|---|
| ... | ... | ... | X.X | ... |

## Data Limitations
- List any unavailable data, hidden fields, or areas excluded from the overall rating.
```

# Other Notes
- Save all files to the directory of the super agent run, in `per-asin-audit/ASIN` subdirectory.
- Do not use web search for this task, as Amazon does not work there. Always access Amazon using the built-in browser.
