---
name: playwright-persistent-sessions
description: Create, configure, and execute persistent and long-running Playwright browser automation loops using exported cookie/session JSON state across local and cloud runners.
---

# Playwright Persistent Browser Automation Skill

This skill guides the creation of highly stable, authenticated browser automation loops that run indefinitely (e.g., for hours on end) on local dev servers or cloud workers without authentication failures or memory leaks.

## Capabilities & Patterns

Use this skill when you need to automate a website that requires logging in, and you want to use the user's cookies/localStorage securely without prompting them for credentials on every run.

### 1. Capture/Setup Script (Run Locally Once)

Use this script template to launch a headed browser (so the user can log in or solve Captchas manually if needed) and export the decrypted session state to a JSON file.

```javascript
// scripts/auth-setup.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureSession() {
  console.log('Launching browser to capture authentication state...');
  // Launch Chrome or Edge channel locally
  const browser = await chromium.launch({
    headless: false, // Must be false so the user can interactively log in
    channel: 'chrome', // Use 'msedge' for Edge
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to target site and wait for the user to complete login
  await page.goto('https://github.com/login');

  console.log('Waiting for user to log in manually...');
  // Wait for a selector that only exists when logged in (e.g., dashboard element)
  await page.waitForSelector('.dashboard', { timeout: 300000 }); // 5 minute timeout

  // Save the cookies and localStorage state
  const statePath = path.join(__dirname, '../state.json');
  await context.storageState({ path: statePath });
  console.log(`Authentication state successfully saved to: ${statePath}`);

  await browser.close();
}

captureSession().catch(console.error);
```

### 2. Cloud Runner Execution Script (Runs Headless)

Use this script template on the cloud VM / GitHub Actions runner. It loads the `state.json` file, bypassing the OS-level encryption limits of raw user directories.

```javascript
// scripts/run-automation.js
const { chromium } = require('playwright');
const path = require('path');

async function runTask() {
  const statePath = path.join(__dirname, '../state.json');
  
  // Launch standard headless Chromium for optimal cloud stability
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage', // Critical to prevent memory issues in Docker/Linux
    ]
  });

  // Inject the unencrypted storage state (cookies + localStorage)
  const context = await browser.newContext({
    storageState: statePath,
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  
  try {
    await page.goto('https://github.com/');
    
    // Verify we are indeed logged in
    const isLoggedIn = await page.locator('.dashboard').isVisible();
    if (!isLoggedIn) {
      console.error('Authentication state expired or invalid. Please run auth-setup.js again.');
      process.exit(1);
    }

    console.log('Successfully authenticated using state.json. Running automation tasks...');
    // Perform tasks...

  } finally {
    // Always clean up resources to release context/browser handles
    await context.close();
    await browser.close();
  }
}

runTask().catch(console.error);
```

### 3. Long-Running Loop Template (Runs for Hours)

To run loops safely for hours, recycle the browser process periodically and run tasks in isolated contexts.

```javascript
// scripts/long-loop.js
const { chromium } = require('playwright');
const path = require('path');

const ITERATION_LIMIT = 50; // Restart browser after 50 iterations to reclaim memory
const statePath = path.join(__dirname, '../state.json');

async function executeLoop() {
  let iterations = 0;
  let browser = await launchBrowser();

  while (true) {
    console.log(`Starting iteration ${iterations + 1}...`);
    
    // Recycle the browser process periodically to prevent memory leaks
    if (iterations >= ITERATION_LIMIT) {
      console.log('Recycling browser to prevent memory leaks...');
      await browser.close();
      browser = await launchBrowser();
      iterations = 0;
    }

    // Create a new context and page for this specific run
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();

    try {
      await page.goto('https://github.com/notifications');
      
      // Perform automated task (e.g. agent voting, checking status)
      // ...

      iterations++;
    } catch (err) {
      console.error('Error occurred in loop iteration:', err);
    } finally {
      // Guarantee context closure to release handles
      await context.close();
    }

    // Delay between iterations (e.g., 30 seconds) to avoid spamming / rate limiting
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

async function launchBrowser() {
  return await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-dev-shm-usage']
  });
}

executeLoop().catch(console.error);
```
