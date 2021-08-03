(function () {
    function createDonationProgress(s) {
        const progress = document.createElement('div');
        progress.classList.add('progress');
        const determinate = document.createElement('div');
        determinate.classList.add('determinate');
        determinate.style.width = (s.totalAmount / s.target * 100).toString(10) + '%';
        determinate.textContent = s.totalAmount + '$';

        progress.append(determinate);
        return progress;
    }

    function createTextBlock(message) {
        const box = document.createElement('p');
        box.textContent = message;

        return box;
    }

    function removeLoading() {
        target.querySelectorAll('.loading').forEach((l) => l.remove());
    }

    const target = document.querySelector('.donation-target');

    fetch('/statistics/monthly').then(async (result) => {
        const statistics = await result.json();
        const column = target.querySelector('.col');

        column.appendChild(createTextBlock(statistics.message));
        column.appendChild(createDonationProgress(statistics));
        removeLoading();
    }).catch(() => {
        target.append('Could not load the perks you own :(');
        removeLoading();
    });
}());
