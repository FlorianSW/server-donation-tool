function enableSubscription() {
    document.querySelector('.custom-message').style.display = 'none';
    document.querySelector('.card-action.one-time').style.display = 'none';

    document.querySelector('.card-action.subscription').style.display = 'block';
}

function enableOneTime() {
    document.querySelector('.custom-message').style.display = 'block';
    document.querySelector('.card-action.one-time').style.display = 'block';

    document.querySelector('.card-action.subscription').style.display = 'none';
}

function initSubscription() {
    document.querySelector('.subscription input').addEventListener('change', function (event) {
        if (event.target.checked) {
            enableSubscription();
        } else {
            enableOneTime();
        }
    });
}

(function () {
    initSubscription();
})();
