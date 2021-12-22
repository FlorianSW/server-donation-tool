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
            return createOrder('paypal').then(function (data) {
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
                },
                body: JSON.stringify({
                    provider: 'paypal',
                }),
            }).then(function (res) {
                return res.json();
            }).then(function (details) {
                window.location.href = `/donate/${details.orderId}/`;
            });
        },
        onCancel: function (data) {
            return fetch('/api/donations/' + data.orderID, {
                method: 'delete',
                credentials: 'same-origin',
                headers: {
                    'x-csrf-token': csrfToken,
                    'content-type': 'application/json',
                    'accept': 'application/json',
                }
            });
        }
    }).render('#paypal-button-container');
}

(function () {
    initPayPalButton();
})();
