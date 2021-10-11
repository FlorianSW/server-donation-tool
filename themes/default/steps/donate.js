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
