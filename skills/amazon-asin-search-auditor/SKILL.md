---
name: amazon-asin-search-auditor
description: Audit an Amazon seller's organic and sponsored search visibility by combining DataDoe search-term data, live Amazon search results, owned-ASIN matching, screenshots, and a reusable dashboard report. Use when asked to run an Amazon ASIN/search visibility audit for a specific DataDoe seller.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
---

# Amazon ASIN Search Auditor

# General Rules
- Execute exactly all actions from the "Action Plan".
- Use the built-in browser directly for any ASIN analysis work.
- Do not finish until all steps are done.
- If you need a script to perform an action, use NodeJS.
- Create a new directory in the project root at `runs/RUN_DIR`, with `RUN_DIR` being `run_YY_MM_DD_HH_mm`. Store all run files in that directory and only in that directory.
- Read `references/asin-visibility-auditor.md` when the user asks for analysis, optimization, or audit work on a specific ASIN.
- When the Action Plan tells you to do so, you MUST spawn a sub-agent. Spawn sub-agents for those steps and only for those steps.
    - Pause your work until the sub-agent is done. It is OK if you need to wait for the sub-agent for a few minutes.
    - Do not repeat the steps that were sent to the sub-agent.

# Action Plan
1. If the DataDoe Seller or Vendor is not provided: Ask the user to input the Seller or Vendor to use.
2. (Spawn a sub-agent for this step) DataDoe resolver:
    - Use the 'sellers_and_vendors_list' tool.
    - Return only `{sellerId, marketplace, displayName}`.
3. (Spawn a sub-agent for these steps) Core term export normalizer:
    - Fetch the following top search terms data:
        - Source: `amazon_child_product_organic_search_ranks_per_week`.
        - Total top 5 search terms by `child_asin_purchase_count` from the last 60 days.
        - Add all other available metrics to the data.
        - Download the report to file using `exports_raw_url_get` method.
        - It is OK if there are fewer than 60 days of data.
    - Write `coreSearchSummaries.json` with normalized fields matching `references/dashboard.md`.
    - Return only the top terms + totals.
4. Prepare a list of unique search terms that appeared in the data.
5. Open Amazon website for the seller's marketplace in the built-in browser:
    - Always use web browser cards that are visible to the user, so the user can follow your actions.
6. If prompted: Accept cookies usage.
7. Change the `Deliver to` to a valid postal code from the capital of the marketplace country.
8. Change the language of the page and currency to the ones local to the marketplace.
9. Search for each unique search term and collect all ASINs with their organic/paid search ranks:
    - To search, enter a URL matching this pattern: `https://AMAZON_DOMAIN/s?k=SEARCH_TERM_URL_ENCODED`.
    - Use this command to URL encode: `node -e "console.log(encodeURIComponent('SEARCH_TERM'))"`.
    - Before collecting the data, make sure that `Deliver to`, language, and currency are properly set.
    - Take a screenshot of the top of each results page in the built-in browser and save it in `search_results/screenshots/st-SEARCH_TERM.png`.
    - Sponsored results are marked as sponsored. If a result is sponsored, it is not organic (a single ASIN cannot be both).
    - For each search term, prepare a JSON file named `search_results/st-SEARCH_TERM.json` with the following content:
    ```json
        {
            "searchTerm": "SEARCH_TERM",
            "amazonMarketplace": "AMAZON_DOMAIN",
            "checkedAt": "CURRENT_DATE",
            "screenshotLocation": "run-root-relative path to the screenshot",
            "organicRanks": [
                {
                    "asin": "ASIN",
                    "organicRank": rank as int,
                    "price_value": price as float 00.00,
                    "price_currency": "CURRENCY_CODE",
                    "asin_name": "NAME_OF_THE_ASIN (exact as displayed in search results)",
                    "asin_rating" review rating as float 0.0 or null if not given in the result tile,
                    "asin_image_url": "LINK_TO_THE_ITEM_IMAGE",
                    "asin_url": "LINK_TO_THE_ITEM (exact URL as the user would click it)",
                    "my_listing": null
                }
            ],
            "ppcRanks": [
                {
                    "asin": "ASIN",
                    "ppcRank": rank as int,
                    "price_value": price as float 00.00,
                    "price_currency": "CURRENCY_CODE",
                    "asin_image_url": "LINK_TO_THE_ITEM_IMAGE",
                    "asin_url": "LINK_TO_THE_ITEM",
                    "my_listing": null
                }
            ]
        }
    ```
11. (Spawn a sub-agent for this step) Extract unique ASINs from all results for each search term using `scripts/list-asins.js`.
12. (Spawn a sub-agent for this step) Fetch active listings for the seller using DataDoe and save it to CSV (include only ASINs):
    - Source: `amazon_listings_with_cogs`.
    - Paginate if the seller has more listings than the Export limit.
13. (Spawn a sub-agent for these steps) Run the file-based post-processor for the step 11 ASIN list, step 12 listings export, and the dashboard build:
    - Mark my listings in JSONs using `scripts/mark-my-listings.js`.
    - Generate `report-data.json`.
    - Render `report.html`.
    - Run contract checks.
    - Return only summary stats + paths.
14. That's all. Open the report page for the user.

If the user asks for analysis / optimization / audit / etc. of a specific ASIN, then follow `references/asin-visibility-auditor.md` directly with the ASIN, the marketplace domain to use, and the location of your run data. Never run this task in a sub-agent.

# Glossary
- ASIN:
    - An ASIN (Amazon Standard Identification Number) is a unique 10-character code Amazon uses to identify and manage products in its marketplace.
    - ASIN matches the regex: `\b[a-zA-Z0-9]{10}\b`.
