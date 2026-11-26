# KURIO — NFT Marketplace

A responsive NFT marketplace built with React and TypeScript, featuring a simulated shopping experience, authentication flows, checkout, and real-time updates.

## Overview

KURIO is a frontend marketplace project designed to simulate the experience of browsing, selecting, and purchasing NFTs.

The application focuses on responsive design, reliable state management, user experience, and automated end-to-end testing.

## Features

- NFT catalog with filtering, sorting, and pagination
- NFT details and product information
- Shopping cart management
- User authentication and registration flows
- User profile and wallet management
- Checkout and order confirmation
- Payment rejection and price-change scenarios
- Real-time marketplace updates
- Responsive layouts for desktop, tablet, and mobile
- Automated end-to-end testing

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Router
- TanStack Query
- Mock Service Worker (MSW)
- [Socket.IO](http://Socket.IO) Client
- Playwright

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```
git clone https://github.com/TGianoni/kurio-nft-marketplace.git
cd kurio-nft-marketplace
npm install
```

### Run locally

```
npm run dev
```

### Production build

```
npm run build
```

### Run end-to-end tests

```
npx playwright install
npx playwright test
```

## Testing

The project includes Playwright end-to-end tests covering core marketplace workflows, checkout scenarios, authentication, and responsive behavior.

Mock Service Worker (MSW) provides deterministic API scenarios for testing success and failure conditions.

## Important Note

This project uses simulated marketplace data and payment scenarios for demonstration and testing purposes. It is not connected to a production blockchain or payment provider.

## Author

**Thiago Gianoni**

GitHub: [@TGianoni](https://github.com/TGianoni)
