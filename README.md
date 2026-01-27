# meroshare-bulk-asba-automation

> ⚠️ **Important Note**  
> This project was built with the help of an AI agent.  
> I experimented, tested, and iterated on real-world failures while leveraging AI to reason about Selenium behavior, Angular form flow, and timing stability.

---

## Overview

**meroshare-bulk-asba-automation** is a bulk, **sequential** automation tool for MeroShare ASBA applications.  
It allows applying for **IPO and FPO issues one account at a time** using Selenium and a real browser.

The design intentionally avoids parallel execution to ensure reliability, reduce UI race conditions, and handle Angular-based validation correctly.

---

## What this project does

- Logs into MeroShare using locally provided credentials
- Navigates through **My ASBA → Apply for Issue**
- Detects and filters **only IPO and FPO issues**
- Automatically fills the ASBA application form:
  - Bank selection
  - Account number
  - Applied kitta
  - CRN
- Handles Angular form validation properly
- Proceeds through the transaction PIN step
- Triggers the final Apply action once it becomes enabled
- Processes multiple users **one by one** (bulk but sequential)
- Keeps the browser open briefly after submission for manual confirmation if needed

---

## What this project does NOT do

- ❌ No parallel or multi-tab automation
- ❌ No backend API scraping or direct API abuse
- ❌ No CAPTCHA, OTP, or security bypassing
- ❌ No guarantee of successful allotment
- ❌ No automation beyond what a normal user can do via the UI

This tool strictly automates **frontend interactions only**.

---

## Technology stack

- Node.js
- Selenium WebDriver
- Google Chrome / ChromeDriver
- JavaScript
- Angular-aware DOM event handling

---

## Handling Angular form flow

MeroShare uses Angular reactive forms, where simply setting input values is insufficient.

This project ensures form stability by:
- Dispatching `input` and `change` events after every field update
- Introducing controlled delays between interactions
- Triggering focus and blur events to allow validation to settle
- Waiting for buttons to become enabled before clicking
- Avoiding fragile direct API calls and relying on the UI lifecycle

These patterns were refined through repeated testing and real failure scenarios.

---

## Bulk processing model

- Credentials are read from a local `credentials.txt` file
- Each user session runs independently
- Only **one browser session runs at a time**
- A delay is enforced between users

This approach prioritizes **stability and safety over speed**.

---

## Ethical & usage notice

This project is intended for **personal experimentation and educational purposes**.

You are responsible for:
- Complying with MeroShare’s terms and policies
- Ensuring you have authorization to use the provided credentials
- Understanding the risks involved in automating financial actions

Use responsibly.

---

## Final note

This repository represents a collaboration between **human intent and AI-assisted engineering**:
- AI was used to analyze failures, timing issues, and Angular behavior
- All final decisions, testing, and responsibility remain with the user

The objective was to understand and stabilize a complex real-world UI flow — not to exploit it.
