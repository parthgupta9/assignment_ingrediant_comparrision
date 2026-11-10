
These are the main prompts and instructions I used while developing the Ingredient Composition Matching App. The development involved discussing the requirements, deciding the architecture, implementing features and testing the results.

"Check this assignment and suggest a whole plan."

(Shared the assignment PDF and discussed the requirements, sample products and expected deliverables.)


"I will make Node + Next + TypeScript."

(Decided on Node.js and Express for the backend, Next.js for the frontend and TypeScript across the project.)


"So what's our approach, what do they want, and how are we dealing with it with a full plan?"

(Discussed the overall flow, matching categories, configurable tolerance and similarity scoring.)

"For close matching, I don't want to reject a product just because it has a small percentage difference or one minor extra ingredient. How should we handle this without affecting the actual matching accuracy?"

(Discussed percentage-point tolerance, extra ingredient limits and the difference between exact and close matches.)

how did you came across Manhattan distance and how does it works in similarity score"

(Discussed L1 distance and how to convert the difference into a 0–100 similarity score.)

"Start. Make 2 separate folders for frontend and backend, and initialize the project."

(Set up independent frontend and backend applications with their own dependencies and configurations.)

"Let's implement the matching engine and API endpoints now. Keep the matching logic separate so we can test it independently of the API."

(Implemented ingredient normalization, matching rules, scoring, explanations and API endpoints.)

" What happens if an ingredient is missing, there are multiple extra ingredients percentages are slightly different"

(Reviewed edge cases and added corresponding backend tests.)

"Now let's build the frontend dashboard and connect it directly to the backend APIs. Include the reference product, matching settings, sample data loading, custom JSON upload, ranked results and composition diff viewer."

