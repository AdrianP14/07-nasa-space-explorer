// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const dateForm = document.getElementById('dateForm');
const getImagesButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');
const galleryStatus = document.getElementById('galleryStatus');
const spaceFact = document.getElementById('spaceFact');
const imageModal = document.getElementById('imageModal');
const closeModalButton = document.getElementById('closeModal');
const modalImage = document.getElementById('modalImage');
const modalDate = document.getElementById('modalDate');
const modalTitle = document.getElementById('modalTitle');
const modalExplanation = document.getElementById('modalExplanation');
const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/';
const apiKey = 'zzFPgKgGJGLNtqHKzRLMwWWwrpWbhjnB86rkzTmG';
const maximumRangeDays = 100;
const apodPageSize = 25;

// Keep the facts in an array so a different one can be picked on each visit.
const spaceFacts = [
	'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
	'The Moon is about 384,400 kilometers from Earth on average.',
	'The International Space Station orbits Earth about once every 90 minutes.',
	'A day on Venus is longer than its year.',
	'Moonlight takes about 1.3 seconds to travel to Earth.'
];

spaceFact.textContent = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

const endDatePicker = flatpickr(endInput, {
	dateFormat: 'Y-m-d',
	minDate: endInput.min,
	maxDate: endInput.max,
	defaultDate: endInput.value,
	disableMobile: true
});

flatpickr(startInput, {
	dateFormat: 'Y-m-d',
	minDate: startInput.min,
	maxDate: startInput.max,
	defaultDate: startInput.value,
	disableMobile: true,
	onChange: (selectedDates) => {
		if (!selectedDates.length) {
			return;
		}

		const selectedStart = selectedDates[0];
		const selectedEnd = new Date(selectedStart);
		const maximumEnd = new Date(`${endInput.max}T00:00:00`);
		selectedEnd.setDate(selectedEnd.getDate() + 8);

		endDatePicker.set('minDate', selectedStart);
		endDatePicker.setDate(selectedEnd > maximumEnd ? maximumEnd : selectedEnd, false);
	}
});

// Ask NASA for the selected dates when the form is submitted.
dateForm.addEventListener('submit', (event) => {
	event.preventDefault();
	loadSpaceImages();
});

// Open the larger image and explanation when an image card is selected.
gallery.addEventListener('click', (event) => {
	const imageCard = event.target.closest('[data-apod-index]');

	if (!imageCard) {
		return;
	}

	showImageDetails(imageCard.dataset.apodIndex);
});

closeModalButton.addEventListener('click', () => imageModal.close());

// Clicking the shaded area outside the dialog also closes it.
imageModal.addEventListener('click', (event) => {
	if (event.target === imageModal) {
		imageModal.close();
	}
});

async function loadSpaceImages() {
	const startDate = new Date(`${startInput.value}T00:00:00Z`);
	const endDate = new Date(`${endInput.value}T00:00:00Z`);
	const dayCount = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;

	if (startDate > endDate) {
		galleryStatus.textContent = 'Choose a start date that is before the end date.';
		return;
	}

	if (dayCount > maximumRangeDays) {
		galleryStatus.textContent = 'Choose a date range of 100 days or fewer.';
		return;
	}

	getImagesButton.disabled = true;
	gallery.replaceChildren();
	galleryStatus.textContent = 'Loading space photos...';

	const latestDate = new Date(`${today}T00:00:00Z`);
	const getPageForDate = (date) => {
		const selectedDate = new Date(`${date}T00:00:00Z`);
		const daysBeforeToday = Math.floor((latestDate - selectedDate) / (1000 * 60 * 60 * 24));
		return Math.floor(daysBeforeToday / apodPageSize) + 1;
	};
	const firstPage = getPageForDate(endInput.value);
	const lastPage = getPageForDate(startInput.value);
	const pageNumbers = Array.from(
		{ length: lastPage - firstPage + 1 },
		(_, index) => firstPage + index
	);

	try {
		const pageRequests = pageNumbers.map(async (pageNumber) => {
			const requestUrl = new URL(apiUrl);
			requestUrl.searchParams.set('page', pageNumber);
			requestUrl.searchParams.set('api_key', apiKey);

			const response = await fetch(requestUrl);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || data.msg || 'NASA could not return photos for those dates.');
			}

			return Array.isArray(data) ? data : [data];
		});
		const apodPages = await Promise.all(pageRequests);
		const apodEntries = apodPages.flat().filter((entry) =>
			entry.date >= startInput.value && entry.date <= endInput.value
		);

		displaySpaceImages(apodEntries);
		galleryStatus.textContent = apodEntries.length
			? `Showing ${apodEntries.length} APOD ${apodEntries.length === 1 ? 'entry' : 'entries'}.`
			: 'No space photos were found for those dates.';
	} catch (error) {
		galleryStatus.textContent = `Unable to load APOD images. ${error.message}`;
	} finally {
		getImagesButton.disabled = false;
	}
}

function displaySpaceImages(apodEntries) {
	gallery.replaceChildren();

	apodEntries.forEach((entry, index) => {
		const card = document.createElement(entry.media_type === 'image' ? 'button' : 'a');
		card.className = 'gallery-item';

		if (entry.media_type === 'image') {
			card.type = 'button';
			card.dataset.apodIndex = index;
			card.setAttribute('aria-label', `View ${entry.title}, ${entry.date}`);

			const image = document.createElement('img');
			image.src = entry.hdurl || entry.url;
			image.alt = '';
			image.loading = 'lazy';
			card.appendChild(image);
		} else {
			card.href = entry.url;
			card.target = '_blank';
			card.rel = 'noopener noreferrer';

			const videoMessage = document.createElement('span');
			videoMessage.className = 'video-message';
			videoMessage.textContent = 'Watch this APOD video on NASA';
			card.appendChild(videoMessage);
		}

		const details = document.createElement('span');
		details.className = 'gallery-copy';

		const title = document.createElement('span');
		title.className = 'gallery-title';
		title.textContent = getPlainText(entry.title);

		const date = document.createElement('time');
		date.className = 'gallery-date';
		date.dateTime = entry.date;
		date.textContent = entry.date;

		details.append(title, date);
		card.appendChild(details);
		gallery.appendChild(card);
	});

	window.apodEntries = apodEntries;
}

function showImageDetails(entryIndex) {
	const entry = window.apodEntries[entryIndex];

	modalImage.src = entry.hdurl || entry.url;
	modalImage.alt = getPlainText(entry.title);
	modalDate.textContent = entry.date;
	modalTitle.textContent = getPlainText(entry.title);
	modalExplanation.textContent = getPlainText(entry.explanation);
	imageModal.showModal();
}

function getPlainText(content) {
	const parsedContent = new DOMParser().parseFromString(content || '', 'text/html');
	return parsedContent.body.textContent.replace(/\s+/g, ' ').trim();
}
