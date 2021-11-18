async function createOrder(provider) {
    var csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    var customMessage = null;
    var textarea = document.querySelector('textarea');
    if (textarea && textarea.value !== '') {
        customMessage = textarea.value;
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

function stripeButton() {
    return document.querySelector('button[name="stripe"]');
}

function initStripeButton() {
    var key = document.querySelector('input[name="stripe-publishable-key"]').value;
    const stripe = Stripe(key);
    var elements, returnUrl;

    stripeButton().addEventListener('click', async function () {
        createOrder('stripe').then(function (data) {
            returnUrl = data.metadata.returnUrl;
            const options = {
                clientSecret: data.metadata.clientSecret,
                appearance: {
                    theme: 'night',
                    labels: 'floating',
                },
            };

            elements = stripe.elements(options);
            const paymentElement = elements.create('payment');
            paymentElement.mount('#payment-element');
        });
    });
    document.querySelector('button#submit').addEventListener('click', async function () {
        const {error} = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: returnUrl,
            },
        });

        if (error) {
            const messageContainer = document.querySelector('#error-message');
            messageContainer.textContent = error.message;
        }
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
    initPayPalButton();
    if (stripeButton()) {
        initStripeButton();
    }
})();
