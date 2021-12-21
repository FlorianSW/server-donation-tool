function initStripeButton() {
    var key = document.querySelector('input[name="stripe-publishable-key"]').value;
    const stripe = Stripe(key);
    var elements, returnUrl;

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

        document.querySelectorAll('.stripe-container .loading').forEach((e) => e.remove());
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

(function () {
    initStripeButton();
})();
