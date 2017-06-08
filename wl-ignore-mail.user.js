// ==UserScript==
// @name        WL Ignore Mail
// @namespace   wl-ignore-mail
// @description Adds an option to ignore individual mail threads.
// @version     0.1.0
// @include     http://www.warlight.net/*
// @include     https://www.warlight.net/*
// @grant       none
// @updateURL   https://github.com/kurogetsusai/wl-ignore-mail/raw/master/wl-ignore-mail.user.js
// ==/UserScript==

'use strict';

/** Turns off mail redirection when you click the mail icon.
 * @returns {void} */
function turnOffMailRedir() {
	document.getElementById('MailLink').href = '/Discussion/MyMail';
}

/** Toggles visibility of the mail icons.
 * @param {string} mode mode (normal|flashing|both|neither)
 * @returns {void} */
function setMailIconMode(mode) {
	const normalIcon   = document.getElementById('MailImgNormal');
	const flashingIcon = document.getElementById('MailImgFlashing');

	switch (mode) {
	case 'normal':
		normalIcon.style.display = 'inline';
		flashingIcon.style.display = 'none';
		break;
	case 'flashing':
		normalIcon.style.display = 'none';
		flashingIcon.style.display = 'inline';
		break;
	case 'both':
		normalIcon.style.display = 'inline';
		flashingIcon.style.display = 'inline';
		break;
	case 'neither':
		normalIcon.style.display = 'none';
		flashingIcon.style.display = 'none';
		break;
	}
}

/** Checks if a mail thread is currently ignored.
 * @param {number} mailId mail thread's ID
 * @returns {boolean} true if the thread is ignored, false otherwise */
function isIgnored(mailId) {
	return (JSON.parse(localStorage['wl-ignore-mail'] || '{"ignored":[]}')).ignored.includes(mailId);
}

/** Downloads user's My Mail page.
 * @returns {Promise<string|Error>} a promise, resolves to the HTML code of the My Mail page */
function downloadMailData() {
	return new Promise((resolve, reject) => {
		const httpRequest = new XMLHttpRequest();

		httpRequest.onreadystatechange = () => {
			if (httpRequest.readyState !== 4)
				return;

			if (httpRequest.status === 200)
				resolve(httpRequest.responseText);
			else
				reject(new Error('Cannot load mail data, HTTP status: ' + httpRequest.status));
		};
		httpRequest.overrideMimeType('text/plain');
		httpRequest.open('GET', '/Discussion/MyMail');
		httpRequest.send();
	});
}

/** Downloads user's mail data, checks if all of them are ignored and modifies the mail icon.
 * @returns {void} */
function fixMailIcon() {
	downloadMailData().then(mailData => {
		const mails = mailData
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.match(/^<tr|^<a href="\/Discussion\/\?ID=/))
			.slice(2, -1)
			.reduce((mails, line) => {
				const isTr = line.startsWith('<tr');
				const mail = isTr ? {} : mails.pop();

				if (isTr) {
					mail.unread = line.includes('UnreadTr');
				} else {
					mail.id = parseInt(line.split('=')[2], 10);
				}

				mails.push(mail);

				return mails;
			}, []);

		if (mails.filter(mail => mail.unread && !isIgnored(mail.id)).length === 0)
			setMailIconMode('normal');
		else
			setMailIconMode('flashing');
	}).catch(error => {
		console.log(error);
	});
}

/** Updates the My Mail page's appearance.
 * @returns {void} */
function updateMyMailPageStyles() {
	setMailIconMode('normal');

	[...document.querySelectorAll('#MainSiteContent table.region > tbody > tr')]
		.slice(1)
		.forEach(tr => {
			const td = tr.querySelector('td');
			const mailId =  parseInt(td.querySelector('a').href.split('=')[1], 10);
			const ignored = isIgnored(mailId);
			const unread = tr.className.includes('UnreadTr');
			const a = td.querySelector('a.wl-ignore-mail.ignore-link');

			a.innerHTML = ignored ? 'Stop Ignoring' : 'Ignore';

			if (unread && ignored)
				tr.style.backgroundColor = '#333';
			else if (unread) {
				tr.style.backgroundColor = '#323400';
				setMailIconMode('flashing');
			}
		});
}

/** Adds the ignore buttons to the My Mail page and updates styles.
 * @returns {void} */
function fixMyMailPage() {
	[...document.querySelectorAll('#MainSiteContent table.region > tbody > tr')]
		.slice(1)
		.forEach(tr => {
			const td = tr.querySelector('td');
			const a = document.createElement('a');
			const lastA = td.querySelector('a:last-child');

			a.className = "wl-ignore-mail ignore-link";
			a.style.fontSize = '9px';
			a.onclick = function (event) {
				const mailId = parseInt(a.parentNode.querySelector('a').href.split('=')[1], 10);
				const data = JSON.parse(localStorage['wl-ignore-mail']);

				if (isIgnored(mailId))
					data.ignored = data.ignored.filter(item => item !== mailId);
				else
					data.ignored.push(mailId);

				localStorage['wl-ignore-mail'] = JSON.stringify(data);
				updateMyMailPageStyles();
			};

			if (lastA !== null)
				td.insertBefore(a, lastA);
			else
				td.appendChild(a);

			[...td.querySelectorAll('a[style^="font-size: 9px"]')]
				.forEach(a => a.style.marginLeft = '6px');
		});

	updateMyMailPageStyles();
}

turnOffMailRedir();

if (document.getElementById('MailImgFlashing').style.display !== 'none') {
	setMailIconMode('neither');
	fixMailIcon();
}

if (location.href.includes('/Discussion/MyMail'))
	fixMyMailPage();
