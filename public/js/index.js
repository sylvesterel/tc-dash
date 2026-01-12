// Navigation button click handler
document.querySelectorAll('.nav-content a').forEach(button => {
    button.addEventListener('click', function() {
        // Remove active from all nav buttons
        document.querySelectorAll('.nav-content a').forEach(btn => {
            btn.classList.remove('active');
        });
        // Add active to clicked button
        this.classList.add('active');
    });
});

fetch('/navbar.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar').innerHTML = data;

        // Sæt active på linket, der matcher den aktuelle URL
        const currentPath = window.location.pathname; // fx "/users"
        const links = document.querySelectorAll('#navbar a');

        links.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    })
    .catch(err => console.error('Fejl ved indlæsning af navbar:', err));