# Harrisons Sales Order Monitoring

## Live Demo
🔗https://harrisons-sales-monitoring-bzwg.vercel.app/ 

## Overview
A responsive React.js web application built for the Harrisons Sabah IT Executive Assessment. It helps a sales team monitor 1,200 sales orders across multiple branches using a mock REST API.

## Features
- Dashboard: Global metrics (Total, Open/Pending, Completed, Cancelled, Total Value).
- Data Table: Order listing with pagination, search, and column sorting.
- Filtering: Dynamic filtering by Branch/Site and Status.
- Modals: Detailed single-order view modal fetching specific record data.
- UX States: Full responsive design handling Loading, Empty, and Error states gracefully.

## Tech Stack
- React.js (Vite)
- Vanilla CSS (Responsive Grid/Flexbox)
- Native Fetch API (with `AbortController` for request cancellation)

## Architecture & API Integration Notes
- State Management: Utilized React Hooks (`useState`, `useEffect`, `useMemo`) for localized state. No external state libraries (like Redux) were needed.
- API Integration: A custom `apiRequest` helper securely passes the `x-assessment-key`. A 350ms debounce was added to the search input to prevent API spam.
- Data Normalization: Because the API's list endpoint returned slightly unpredictable JSON schemas, I built a `normalizeOrder` utility function that hunts for the amount across multiple nested keys (e.g., `IAR_TotalSOAmount` and `financials.total_amount`) to ensure the UI never crashes.
- Dynamic Dropdowns: Dropdowns are populated dynamically by combining the `/meta` endpoint data with unique values extracted directly from the loaded orders.

## AI Use & Testing Disclosure
- AI Tools: Used ChatGPT to generate initial React boilerplate, assist with CSS Grid layouts, and brainstorm `AbortController` implementation for race conditions.
- Verification: I manually inspected the live API JSON to correct AI hallucinations regarding JSON key names. I rewrote the data parsing logic to ensure accurate amounts.
- Testing: I tested the Error state by blocking the API request in Chrome DevTools, the Empty state by searching for non-existent IDs, and the Loading state by throttling the network. I also manually verified pagination, sorting, and modal data integrity.

## Known Limitations & Future Enhancements
Following the assessment guidelines to prioritize a reliable, functional solution within the recommended scope, the following are intentional trade-offs and future enhancement opportunities:
- No Client-Side Caching: Navigating between pages triggers a new network request. In production, I would implement React Query or SWR for caching.
- Automated Testing: While manually tested extensively, automated unit tests (Jest) for the data normalization and API wrappers were deferred.
- Advanced Filtering: The API supports `date_range`, `min_total`, and `max_total`. Implementing UI controls for these would be the next step.
- Data Visualization: A line graph tracking monthly sales per branch would be a great feature, but was deferred to prioritize core table stability.

## Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/dorin-rgv/harrisons-sales-monitoring.git
