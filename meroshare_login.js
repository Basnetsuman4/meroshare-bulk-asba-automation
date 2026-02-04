require("dotenv").config();
const fs = require("fs");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

/* =========================
   PARSE CREDENTIALS FILE
========================= */
function parseCredentialsFile(path) {
	const raw = fs.readFileSync(path, "utf8");

	const blocks = raw
		.split(/\n\s*\n/)
		.map((b) => b.trim())
		.filter(Boolean);

	const users = [];

	for (const block of blocks) {
		const lines = block.split("\n");
		const user = {};

		for (const line of lines) {
			const [key, ...rest] = line.split("=");
			if (!key || rest.length === 0) continue;
			user[key.trim()] = rest.join("=").trim();
		}

		const required = [
			"UserID",
			"MS_DP",
			"MS_USERNAME",
			"MS_PASSWORD",
			"MS_CRN",
			"MS_PIN",
		];

		for (const r of required) {
			if (!user[r]) {
				throw new Error(`Missing ${r} in credentials.txt`);
			}
		}

		users.push({
			id: user.UserID,
			dp: user.MS_DP,
			username: user.MS_USERNAME,
			password: user.MS_PASSWORD,
			crn: user.MS_CRN,
			pin: user.MS_PIN,
			headless: user.HEADLESS === "true",
		});
	}

	return users;
}

/* =========================
   MAIN RUNNER
========================= */
async function runAutomation() {
	const users = parseCredentialsFile("credentials.txt");
	console.log(`Loaded ${users.length} users`);

	for (const user of users) {
		console.log(`\n===== USER ${user.id} START =====`);
		await meroshareLogin(user);
		console.log(`===== USER ${user.id} END =====\n`);
		await new Promise((r) => setTimeout(r, 5000));
	}
}

/* =========================
   MEROSHARE FLOW
========================= */
async function meroshareLogin(account) {
	let options = new chrome.Options();
	options.addArguments("--disable-notifications");

	if (account.headless) {
		options.addArguments("--headless");
		options.addArguments("--window-size=1920,1080");
	} else {
		options.addArguments("--start-maximized");
	}

	const driver = await new Builder()
		.forBrowser("chrome")
		.setChromeOptions(options)
		.build();

	try {
		await driver.get("https://meroshare.cdsc.com.np/#/login");

		// DP
		const dpBox = await driver.wait(
			until.elementLocated(By.css(".select2-selection--single")),
			15000,
		);
		await dpBox.click();

		const dpSearch = await driver.wait(
			until.elementLocated(By.css(".select2-search__field")),
			5000,
		);
		await dpSearch.sendKeys(account.dp, Key.RETURN);

		// Login
		await driver.findElement(By.id("username")).sendKeys(account.username);
		await driver.findElement(By.id("password")).sendKeys(account.password);
		await driver.findElement(By.css('button[type="submit"]')).click();

		await driver.wait(until.urlContains("dashboard"), 15000);

		// My ASBA → Apply
		await driver
			.findElement(By.xpath("//span[contains(text(),'My ASBA')]"))
			.click();
		await driver
			.findElement(By.xpath("//span[contains(text(),'Apply for Issue')]"))
			.click();
		await driver.sleep(3000);

		/* =========================
		   IPO / FPO ISSUE FILTER
		========================= */
		const issueCards = await driver.findElements(
			By.xpath("//div[contains(@class,'company-name')]"),
		);

		let matched = false;

		for (const card of issueCards) {
			const text = (await card.getText()).toUpperCase();

			if (text.includes("IPO") || text.includes("FPO")) {
				console.log(`✔ MATCHED ISSUE: ${text.replace(/\s+/g, " ")}`);

				const applyBtn = await card.findElement(
					By.xpath(
						"./ancestor::div[contains(@class,'row')]//button[contains(@class,'btn-issue')]",
					),
				);

				await driver.executeScript(
					"arguments[0].scrollIntoView({block:'center'})",
					applyBtn,
				);

				await driver.sleep(1200);
				await applyBtn.click();

				matched = true;
				break;
			}
		}

		if (!matched) {
			console.log("⚠ No IPO/FPO issue found. Skipping user.");
			return;
		}

		await driver.sleep(5000);

		// FORM
		const bank = await driver.findElement(By.id("selectBank"));
		const bankOpts = await bank.findElements(By.css("option"));
		await bankOpts[1].click();
		await driver.executeScript(
			"arguments[0].dispatchEvent(new Event('change'))",
			bank,
		);
		await driver.sleep(1500);

		const acc = await driver.findElement(By.id("accountNumber"));
		const accOpts = await acc.findElements(By.css("option"));
		await accOpts[1].click();
		await driver.executeScript(
			"arguments[0].dispatchEvent(new Event('change'))",
			acc,
		);
		await driver.sleep(1500);

		const kitta = await driver.findElement(By.id("appliedKitta"));
		await kitta.clear();
		await kitta.sendKeys("10");
		await driver.executeScript(
			"arguments[0].dispatchEvent(new Event('input'));arguments[0].dispatchEvent(new Event('change'));",
			kitta,
		);

		const crn = await driver.findElement(By.id("crnNumber"));
		await crn.clear();
		await crn.sendKeys(account.crn);
		await driver.executeScript(
			"arguments[0].dispatchEvent(new Event('input'));arguments[0].dispatchEvent(new Event('change'));",
			crn,
		);

		await driver.findElement(By.id("disclaimer")).click();
		await driver.sleep(1000);

		await driver
			.findElement(By.css("button.btn-primary[type='submit']"))
			.click();
		await driver.sleep(4000);

		// PIN
		const pin = await driver.wait(
			until.elementLocated(By.id("transactionPIN")),
			10000,
		);

		const actions = driver.actions({ async: true });
		await actions.move({ origin: pin }).click().perform();

		await pin.sendKeys(Key.CONTROL, "a", Key.DELETE);
		for (const d of account.pin) {
			await pin.sendKeys(d);
			await driver.sleep(300);
		}

		await actions
			.move({ origin: await driver.findElement(By.tagName("header")) })
			.click()
			.perform();

		await driver.sleep(1500);

		const finalApply = await driver.wait(
			until.elementLocated(
				By.xpath("//button[.//span[contains(text(),'Apply')]]"),
			),
			10000,
		);

		const disabled = await finalApply.getAttribute("disabled");

		if (disabled === null) {
			await actions.move({ origin: finalApply }).pause(600).click().perform();
			console.log(`✔ User ${account.id}: Apply button clicked, checking submission status...`);

			// Wait for submission result (success modal, error message, or other indicators)
			await driver.sleep(3000);

			try {
				// Check for success indicators (modal, toast, or success message)
				const successElement = await driver.wait(
					until.elementLocated(
						By.xpath(
							"//*[contains(text(),'Success') or contains(text(),'success') or contains(text(),'submitted') or contains(text(),'Submitted') or contains(@class,'success') or contains(@class,'alert-success')]",
						),
					),
					10000,
				);

				const successText = await successElement.getText();
				console.log(`✔ User ${account.id}: Application submitted successfully!`);
				console.log(`   Success message: ${successText}`);
			} catch (successError) {
				// Check for error indicators
				try {
					const errorElement = await driver.findElement(
						By.xpath(
							"//*[contains(text(),'Error') or contains(text(),'error') or contains(text(),'failed') or contains(text(),'Failed') or contains(@class,'error') or contains(@class,'alert-danger')]",
						),
					);

					const errorText = await errorElement.getText();
					console.log(`❌ User ${account.id}: Application submission failed!`);
					console.log(`   Error message: ${errorText}`);
				} catch (errorCheckError) {
					// No clear success or error message found
					console.log(
						`⚠ User ${account.id}: Apply button was clicked, but submission status is unclear.`,
					);
					console.log(
						`   Please manually verify the submission in the browser.`,
					);
				}
			}

			await driver.sleep(15000);
		} else {
			console.log(`⚠ User ${account.id}: Apply button is disabled/locked`);
			await driver.sleep(5000);
		}
	} catch (e) {
		console.error(`❌ User ${account.id} ERROR:`, e.message);
	} finally {
		await driver.quit();
	}
}

runAutomation();
