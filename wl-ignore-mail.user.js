// ==UserScript==
// @name        WL Ignore Mail
// @namespace   wl-ignore-mail
// @description Adds an option to ignore individual mail threads.
// @version     0.2.2
// @include     http://www.warlight.net/*
// @include     https://www.warlight.net/*
// @grant       none
// @updateURL   https://github.com/kurogetsusai/wl-ignore-mail/raw/master/wl-ignore-mail.user.js
// ==/UserScript==

'use strict';

/** Reads the data stored in local storage.
 * @returns {object} the data */
function readData() {
	return JSON.parse(localStorage['wl-ignore-mail'] || '{"ignored":[]}');
}

/** Saves the data to local storage.
 * @param {object} data the data
 * @returns {void} */
function saveData(data) {
	localStorage['wl-ignore-mail'] = JSON.stringify(data);
}

/** Sets mail icon's target URL.
 * @param {string} url new URL for the mail icon
 * @returns {void} */
function setMailIconTarget(url) {
	const redirLink = document.getElementById('MailLink');

	redirLink.href = url;
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
	return readData().ignored.includes(mailId);
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

/** Modifies the mail icon.
 * @param {array} newMails unread unignored mails' data
 * @returns {void} */
function fixMailIcon(newMails) {
	switch (newMails.length) {
	case 0:
		setMailIconTarget('/Discussion/MyMail');
		setMailIconMode('normal');
		break;
	case 1:
		setMailIconTarget('/Discussion/?ID=' + newMails[0].id +
		(newMails[0].offset === undefined ? '' : ('&Offset=' + newMails[0].offset)));
		setMailIconMode('flashing');
		break;
	default:
		setMailIconTarget('/Discussion/MyMail');
		setMailIconMode('flashing');
	}
}

/** Updates the My Mail page's appearance.
 * @returns {void} */
function updateMyMailPageStyles() {
	const newMails = [];

	[...document.querySelectorAll('#MainSiteContent table.region > tbody > tr')]
		.slice(1)
		.forEach(tr => {
			const td = tr.querySelector('td');
			const mailId = parseInt(td.querySelector('a').href.split('=')[1], 10);
			const offset = parseInt(tr.querySelector('a:last-child').href.split('=').reverse()[0], 10) || undefined;
			const ignored = isIgnored(mailId);
			const unread = tr.className.includes('UnreadTr');
			const a = td.querySelector('a.wl-ignore-mail.ignore-link');

			a.innerHTML = ignored ? 'Stop Ignoring' : 'Ignore';

			if (unread && ignored)
				tr.style.backgroundColor = '#333';
			else if (unread) {
				tr.style.backgroundColor = '#323400';

				newMails.push({
					unread: true,
					offset: offset,
					id: mailId
				});
			}
		});

	fixMailIcon(newMails);
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
				const data = readData();

				if (isIgnored(mailId))
					data.ignored = data.ignored.filter(item => item !== mailId);
				else
					data.ignored.push(mailId);

				saveData(data);
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

downloadMailData().then(mailData => {
	const mails = mailData
		.split('\n')
		.map(line => line.trim())
		.filter(line => line.match(/^<tr|^<a href="\/Discussion\/\?ID=|Jump to Last Page/))
		.slice(2, -1)
		.reduce((mails, line) => {
			const isTr = line.startsWith('<tr');
			const mail = isTr ? {} : mails.pop();

			if (isTr)
				mail.unread = line.includes('UnreadTr');
			else if (line.startsWith('<a href="/Discussion/?ID='))
				mail.id = parseInt(line.split('=')[2], 10);
			else if (line.includes('Jump to Last Page'))
				mail.offset = parseInt(line.split('=')[4], 10);

			mails.push(mail);

			return mails;
		}, []);

	const newMails = mails.filter(mail => mail.unread && !isIgnored(mail.id));

	if (document.getElementById('MailImgFlashing').style.display === 'none') {
		fixMailIcon([]);
	} else {
		setMailIconMode('neither');
		fixMailIcon(newMails);
	}

	if (location.href.includes('/Discussion/MyMail'))
		fixMyMailPage();
}).catch(error => {
	console.log(error);
});
