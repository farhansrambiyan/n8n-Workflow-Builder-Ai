// Tally embed script - CSP compliant approach
window.loadTallyScript = function () {
    ("Loading Tally iframe...");

    // Set the iframe src directly - this is sufficient for Tally forms to work
    document.querySelectorAll("iframe[data-tally-src]:not([src])").forEach(function (e) {
        ("Setting iframe src:", e.dataset.tallySrc);
        e.src = e.dataset.tallySrc;
    });
};