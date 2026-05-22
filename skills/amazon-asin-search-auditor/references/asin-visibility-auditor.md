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
- For context, fetch from DataDoe:
    - Profitability of that ASIN from the last 64 days aggregated by week. Use the `amazon_profit_by_sku_and_date` source.
    - Latest available data about this ASIN from the `amazon_child_product_search_performance_per_month` source.
- Use built-in browser to grab insights on how users see that ASIN page and to get details of its competitors from search results.

# Output
- Present a short summary followed by a table with details in the following areas: Title & Bullet Points, Images, PPC Budget and Efficiency, Price and Ratings.
- For each of the areas show the following columns:
    - Name of the area
    - Rating: number from 0 to 5 in 0.5 steps, where 5 is the best and 3 is neutral.
    - Details of the rating: 2-3 sentence justification of the rating.
    - Recommendations: 2-3 sentence recommendations for improvement OR empty if no recommendations are needed or other aspects are a priority right now.
- Follow this by an overall rating for the ASIN and (if improvements are needed) up to 3 priority improvements based on the table above.
- At the end, add a table with up to 5 top competitors for that ASIN based on the search results. For each competitor show the following columns:
    - Name of the competitor
    - Price
    - URL
    - Competitor Score: how much that competitor is a threat to the ASIN. 0-5, where 5 is the most threatening.
    - What we can learn from that competitor: 2-3 sentences about what we can learn from that competitor.

# Output Format
Output everything as a simple markdown document saved to a file. Print only the file location.

# Other Notes
- Save all files to the directory of the super agent run, in `per-asin-audit/ASIN` subdirectory.
- Do not use web search for this task, as Amazon does not work there. Always access Amazon using the built-in browser.
