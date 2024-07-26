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
            }).then(async function (res) {
                let error;
                if (res.status === 404) {
                    error = 'There was an error with your donation, please restart the ordering transaction again.';
                } else if (res.status === 400) {
                    const body = await res.json();
                    error = `There was an error processing your donation. Please find attached the details. You might be able to retry your donation, otherwise please reach out to the support with the provided error message. Error: ${body.error}`;
                }

                if (error) {
                    throw new Error(error);
                } else {
                    return await res.json();
                }
            }).then(function (details) {
                let query = '';
                if (document.querySelectorAll('input[name="gift"]').length === 0) {
                    query = '?redeem=true';
                }
                window.location.href = `/donate/${details.orderId}${query}`;
            }).catch((msg) => {
                document.querySelector('.error-container').style.display = 'block';
                document.querySelector('#error-text').innerText = msg;
            });
        },
        onCancel: function (data) {
            document.querySelector('.error-container').style.display = 'block';
            document.querySelector('#error-text').innerText = 'The payment was cancelled. You can restart the payment by clicking the pay button again.';
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
