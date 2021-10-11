function initPayPalButton() {
    var csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    paypal.Buttons({
        style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'donate',
        },
        createOrder: function () {
            var customMessage = null;
            var textarea = document.querySelector('textarea');
            if (textarea && textarea.value !== '') {
                customMessage = textarea.value;
            }

            return fetch('/api/donations', {
                method: 'post',
                credentials: 'same-origin',
                headers: {
                    'x-csrf-token': csrfToken,
                    'content-type': 'application/json',
                    'accept': 'application/json',
                },
                body: JSON.stringify({
                    customMessage: customMessage,
                }),
            }).then(function (res) {
                return res.json();
            }).then(function (data) {
                return data.orderId;
            });
        },
        onApprove: function (data) {
            return fetch('/api/donations/' + data.orderID, {
                method: 'post',
                credentials: 'same-origin',
                headers: {
                    'x-csrf-token': csrfToken,
                    'content-type': 'application/json',
                    'accept': 'application/json',
                }
            }).then(function (res) {
                return res.json();
            }).then(function (details) {
                window.location.href = `/donate/${details.orderId}/`;
            })
        }
    }).render('#paypal-button-container');
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
    initPayPalButton();
})();
