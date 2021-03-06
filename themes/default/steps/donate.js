async function createOrder(provider) {
    var csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    var customMessage = null;
    var messageElement = document.querySelector('#custom-message');
    if (messageElement && messageElement.textContent.trim() !== '') {
        customMessage = messageElement.textContent.trim();
    }

    return await fetch('/api/donations', {
        method: 'post',
        credentials: 'same-origin',
        headers: {
            'x-csrf-token': csrfToken,
            'content-type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({
            customMessage: customMessage,
            provider: provider,
        }),
    }).then(function (res) {
        return res.json();
    });
}

function initTextareaBehaviour() {
    var textarea = document.querySelector('textarea');
    var initialHeight = 0;
    if (textarea === null) {
        return;
    }

    textarea.addEventListener('keypress', function () {
        if (initialHeight < 1) {
            initialHeight = textarea.getBoundingClientRect().height;
        }
        textarea.style.height = initialHeight + 'px';
        textarea.style.height = Math.max(initialHeight, textarea.scrollHeight) + 'px';
    });
}

(function () {
    initTextareaBehaviour();
})();
