(function () {
    var shareButton = document.querySelector('.clickable');
    var shareInput = document.querySelector('input#share');
    shareButton.addEventListener('click', function () {
        shareInput.select();
        navigator.clipboard.writeText(shareInput.value);
    });
    shareInput.addEventListener('click', function () {
        shareInput.select();
    });
})();
