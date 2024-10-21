// script.js

// Variables related to the main page functionalities
let startAutocomplete;
let endAutocomplete;
let stopAutocompletes = [];
let stopCount = 0;
let map;
let directionsService;
let directionsRenderer;
let calculatedDistanceKm; // Store the calculated distance in kilometers
let totalCost; // Store the calculated cost in pounds, euros, or dollars
let travelTimeSeconds; // Store the travel time in seconds

// Function to initialize the map and related functionalities
function initMap() {
    // Initialize the map centered on the UK
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 54.505, lng: -2.09 }, // Approximate center of the UK
        zoom: 6, // Adjust zoom level to show the UK
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: true, // Make the route draggable
    });
    directionsRenderer.setMap(map);

    // Initialize autocomplete for start and end locations
    startAutocomplete = new google.maps.places.Autocomplete(document.getElementById('start-location'), {
        types: ['geocode'],
    });
    endAutocomplete = new google.maps.places.Autocomplete(document.getElementById('end-location'), {
        types: ['geocode'],
    });

    // Bias the autocomplete to map bounds
    startAutocomplete.bindTo('bounds', map);
    endAutocomplete.bindTo('bounds', map);

    // Add place changed listeners
    startAutocomplete.addListener('place_changed', () => {
        const place = startAutocomplete.getPlace();
        if (!place.geometry) {
            displayError('Please select a valid start location from the suggestions.');
        } else {
            clearError();
        }
    });

    endAutocomplete.addListener('place_changed', () => {
        const place = endAutocomplete.getPlace();
        if (!place.geometry) {
            displayError('Please select a valid end location from the suggestions.');
        } else {
            clearError();
        }
    });

    // Add event listener to dynamically add stops
    const addStopBtn = document.getElementById('add-stop-btn');
    if (addStopBtn) {
        addStopBtn.addEventListener('click', addStopField);
    }

    // Event listener for the Calculate button
    const calculateBtn = document.getElementById('calculate-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculate);
    }

    // Event listener for the Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }

    // Event listener for unit conversion button (Convert Distance)
    const convertDistanceBtn = document.getElementById('convert-distance-btn');
    if (convertDistanceBtn) {
        convertDistanceBtn.addEventListener('click', convertDistance);
    }

    // Add an event listener for when the directions change due to dragging
    directionsRenderer.addListener('directions_changed', () => {
        const directions = directionsRenderer.getDirections();
        if (directions) {
            const route = directions.routes[0];
            // Recalculate distance and time based on new route
            recalculateFromDraggedRoute(route);
        }
    });
}

// Event listeners and functions that should run on every page
document.addEventListener('DOMContentLoaded', () => {
    // Event listener for the theme switch
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.addEventListener('change', toggleTheme);
    }

    // Load theme preference from localStorage
    loadThemePreference();

    // Help Modal Functionality
    const helpButton = document.getElementById('help-button');
    const helpModal = document.getElementById('help-modal');
    const closeHelpButton = document.getElementById('close-help');

    if (helpButton && helpModal && closeHelpButton) {
        // Open Modal when Help Button is Clicked
        helpButton.addEventListener('click', () => {
            helpModal.classList.add('show');
            helpModal.style.display = 'block';
            closeHelpButton.focus();
        });

        // Close Modal when Close Button is Clicked
        closeHelpButton.addEventListener('click', () => {
            helpModal.classList.remove('show');
            setTimeout(() => {
                helpModal.style.display = 'none';
            }, 300); // Match the CSS transition duration
            helpButton.focus();
        });

        // Close Modal when Clicking Outside the Modal Content
        window.addEventListener('click', (event) => {
            if (event.target == helpModal) {
                helpModal.classList.remove('show');
                setTimeout(() => {
                    helpModal.style.display = 'none';
                }, 300);
                helpButton.focus();
            }
        });

        // Close Modal with Escape Key
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                helpModal.classList.remove('show');
                setTimeout(() => {
                    helpModal.style.display = 'none';
                }, 300);
                helpButton.focus();
            }
        });
    }
});

// Light/Dark mode toggle
function toggleTheme() {
    const isChecked = document.getElementById('theme-switch').checked;
    const body = document.body;
    const themeLabel = document.getElementById('theme-label');

    if (isChecked) {
        body.classList.add('dark-mode');
        themeLabel.innerText = 'Dark Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.remove('dark-mode');
        themeLabel.innerText = 'Light Mode';
        localStorage.setItem('theme', 'light');
    }
}

// Load the saved theme preference from localStorage
function loadThemePreference() {
    const theme = localStorage.getItem('theme');
    const themeSwitch = document.getElementById('theme-switch');
    const themeLabel = document.getElementById('theme-label');

    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeSwitch) themeSwitch.checked = true;
        if (themeLabel) themeLabel.innerText = 'Dark Mode';
    } else {
        document.body.classList.remove('dark-mode');
        if (themeSwitch) themeSwitch.checked = false;
        if (themeLabel) themeLabel.innerText = 'Light Mode';
    }
}

// Additional functions for the main page
// Only define these functions if on the main page
if (document.getElementById('map')) {
    // All functions related to map and journey calculations

    // Show loading spinner
    function showLoadingSpinner() {
        document.getElementById('loading-spinner').style.display = 'block';
    }

    // Hide loading spinner
    function hideLoadingSpinner() {
        document.getElementById('loading-spinner').style.display = 'none';
    }

    // Display an error message
    function displayError(message) {
        document.getElementById('error-message').innerText = message;
    }

    // Clear the error message
    function clearError() {
        document.getElementById('error-message').innerText = '';
    }

    // Validate form inputs
    function validateInputs() {
        const fuelEfficiency = parseFloat(document.getElementById('fuel-efficiency').value);
        const fuelPrice = parseFloat(document.getElementById('fuel-price').value);

        if (isNaN(fuelEfficiency) || fuelEfficiency <= 0) {
            displayError('Please enter a valid fuel efficiency.');
            return false;
        }

        if (isNaN(fuelPrice) || fuelPrice <= 0) {
            displayError('Please enter a valid fuel price.');
            return false;
        }

        // Validate start and end locations
        const startLocationInput = document.getElementById('start-location').value;
        const endLocationInput = document.getElementById('end-location').value;

        if (!startLocationInput || !endLocationInput) {
            displayError('Please enter valid start and end locations.');
            return false;
        }

        return true;
    }

    // Add new stop field dynamically
    function addStopField() {
        stopCount++;

        // Create a new input field for the stop
        const stopContainer = document.createElement('div');
        stopContainer.classList.add('input-group');
        stopContainer.innerHTML = `
            <label for="stop-location-${stopCount}">Stop ${stopCount}:</label>
            <input type="text" id="stop-location-${stopCount}" placeholder="Enter stop ${stopCount} location" aria-label="Stop ${stopCount}">
        `;

        // Append the stop field to the container
        document.getElementById('stops-container').appendChild(stopContainer);

        // Initialize autocomplete for the new stop
        const stopAutocomplete = new google.maps.places.Autocomplete(document.getElementById(`stop-location-${stopCount}`), {
            types: ['geocode'],
        });

        // Bias the autocomplete to map bounds
        stopAutocomplete.bindTo('bounds', map);

        // Add place changed listener
        stopAutocomplete.addListener('place_changed', () => {
            const place = stopAutocomplete.getPlace();
            if (!place.geometry) {
                displayError(`Please select a valid location for Stop ${stopCount} from the suggestions.`);
            } else {
                clearError();
            }
        });

        // Add this autocomplete to the list of stop autocompletes
        stopAutocompletes.push(stopAutocomplete);
    }

    // Calculate journey details
    function calculate() {
        // Clear previous errors and show loading spinner
        clearError();
        if (!validateInputs()) return;
        showLoadingSpinner();

        const fuelEfficiency = parseFloat(document.getElementById('fuel-efficiency').value);
        const fuelEfficiencyUnit = document.getElementById('efficiency-unit').value;

        const fuelPrice = parseFloat(document.getElementById('fuel-price').value);
        const fuelPriceUnit = document.getElementById('fuel-price-unit').value;

        const startPlace = startAutocomplete.getPlace();
        const endPlace = endAutocomplete.getPlace();

        // Validate that start and end places are valid
        if (!startPlace || !startPlace.geometry || !endPlace || !endPlace.geometry) {
            hideLoadingSpinner();
            displayError('Please select valid start and end locations from the suggestions.');
            return;
        }

        // Collect waypoints (additional stops)
        const waypoints = [];
        for (let i = 0; i < stopAutocompletes.length; i++) {
            const stopPlace = stopAutocompletes[i].getPlace();
            if (!stopPlace || !stopPlace.geometry) {
                hideLoadingSpinner();
                displayError(`Please select a valid location for Stop ${i + 1} from the suggestions.`);
                return;
            }
            waypoints.push({
                location: stopPlace.formatted_address,
                stopover: true,
            });
        }

        const startLocation = startPlace.formatted_address;
        const endLocation = endPlace.formatted_address;

        calculateDistance(startLocation, endLocation, waypoints)
            .then(() => {
                // Update the displayed distance
                document.getElementById('distance').value = calculatedDistanceKm.toFixed(2);
                const distanceUnit = document.getElementById('distance-unit').value;
                document.getElementById('distance-result').innerText = `Total Distance: ${calculatedDistanceKm.toFixed(2)} km`;

                // Perform cost and emissions calculations
                performCalculations(
                    fuelEfficiency,
                    fuelEfficiencyUnit,
                    fuelPrice,
                    fuelPriceUnit,
                    calculatedDistanceKm,
                    'kilometers' // Use kilometers directly
                );

                // Hide loading spinner
                hideLoadingSpinner();
            })
            .catch((error) => {
                hideLoadingSpinner();
                displayError('Error calculating distance: ' + error);
            });
    }

    // Calculate distance between locations
    function calculateDistance(start, end, waypoints) {
        return new Promise((resolve, reject) => {
            directionsService.route(
                {
                    origin: start,
                    destination: end,
                    waypoints: waypoints,
                    travelMode: 'DRIVING',
                },
                (response, status) => {
                    try {
                        if (status === 'OK') {
                            directionsRenderer.setDirections(response);
                            const route = response.routes[0];
                            let totalDistanceMeters = 0;
                            travelTimeSeconds = 0;

                            route.legs.forEach(leg => {
                                totalDistanceMeters += leg.distance.value;
                                travelTimeSeconds += leg.duration.value;
                            });

                            calculatedDistanceKm = totalDistanceMeters / 1000; // Convert to kilometers
                            resolve(calculatedDistanceKm);

                            // Display travel time
                            displayTravelTime();
                        } else {
                            reject(status);
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    // Perform cost and emissions calculations
    function performCalculations(fuelEfficiency, efficiencyUnit, fuelPrice, priceUnit, distance, distanceUnit) {
        // Convert all units to standard (kilometers, liters)
        let distanceKm = distance;

        let litersPerUnit; // liters per mile or liters per kilometer based on unit
        if (efficiencyUnit.startsWith('mpg')) {
            // Calculate liters needed per mile based on MPG type
            if (efficiencyUnit === 'mpg_uk') {
                const litersPerGallon = 4.54609; // Imperial gallon
                litersPerUnit = litersPerGallon / fuelEfficiency; // liters per mile
            } else if (efficiencyUnit === 'mpg_us') {
                const litersPerGallon = 3.78541; // US gallon
                litersPerUnit = litersPerGallon / fuelEfficiency; // liters per mile
            }
        } else {
            // L/100km to liters per kilometer
            litersPerUnit = fuelEfficiency / 100; // liters per kilometer
        }

        let totalLitersNeeded;
        if (efficiencyUnit.startsWith('mpg')) {
            // Convert distance from km to miles for MPG
            const distanceInMiles = distanceKm / 1.60934;
            totalLitersNeeded = litersPerUnit * distanceInMiles;
        } else {
            // Calculate total liters needed based on liters per kilometer
            totalLitersNeeded = litersPerUnit * distanceKm;
        }

        let fuelPricePerLiter;
        let currencySymbol;

        if (priceUnit === 'pence_per_liter') {
            fuelPricePerLiter = fuelPrice / 100; // Convert pence to pounds
            currencySymbol = '£';
        } else if (priceUnit === 'cents_per_liter') {
            fuelPricePerLiter = fuelPrice / 100; // Convert cents to euros
            currencySymbol = '€';
        } else if (priceUnit === 'cents_per_gallon') {
            const litersPerGallon = 3.78541; // US gallon to liters
            fuelPricePerLiter = (fuelPrice / 100) / litersPerGallon; // Convert cents per gallon to dollars per liter
            currencySymbol = '$';
        } else {
            // Default to pounds if unrecognized unit
            fuelPricePerLiter = fuelPrice / 100;
            currencySymbol = '£';
        }

        // Calculate total cost
        totalCost = totalLitersNeeded * fuelPricePerLiter;

        // CO₂ emissions (average 2.31 kg CO₂ per liter of petrol)
        const emissions = totalLitersNeeded * 2.31;

        // Update the DOM with the results
        document.getElementById('cost-result').innerText = `Total Cost: ${currencySymbol}${totalCost.toFixed(2)}`;
        document.getElementById('emissions-result').innerText = `Estimated CO₂ Emissions: ${emissions.toFixed(2)} kg`;
        document.getElementById('distance-result').innerText = `Total Distance: ${distanceKm.toFixed(2)} km`;
    }

    // Display travel time
    function displayTravelTime() {
        const hours = Math.floor(travelTimeSeconds / 3600);
        const minutes = Math.floor((travelTimeSeconds % 3600) / 60);
        document.getElementById('travel-time-result').innerText = `Estimated Travel Time: ${hours}h ${minutes}m`;
    }

    // Convert distance between kilometers and miles
    function convertDistance() {
        const distanceDisplay = document.getElementById('distance-result');
        if (distanceDisplay.innerText.includes('km')) {
            const distanceInMiles = (calculatedDistanceKm / 1.60934).toFixed(2);
            distanceDisplay.innerText = `Total Distance: ${distanceInMiles} miles`;
        } else {
            distanceDisplay.innerText = `Total Distance: ${calculatedDistanceKm.toFixed(2)} km`;
        }
    }

    // Reset the form
    function resetForm() {
        document.getElementById('journey-form').reset();
        document.getElementById('distance').value = '';
        document.getElementById('distance-result').innerText = '';
        document.getElementById('travel-time-result').innerText = '';
        document.getElementById('cost-result').innerText = '';
        document.getElementById('emissions-result').innerText = '';
        document.getElementById('error-message').innerText = '';

        // Clear additional stops
        document.getElementById('stops-container').innerHTML = '';
        stopAutocompletes = [];
        stopCount = 0;

        // Clear the map
        directionsRenderer.setDirections({ routes: [] });
    }

    // Recalculate distance and time from a dragged route
    function recalculateFromDraggedRoute(route) {
        let totalDistanceMeters = 0;
        travelTimeSeconds = 0;

        route.legs.forEach(leg => {
            totalDistanceMeters += leg.distance.value;
            travelTimeSeconds += leg.duration.value;
        });

        calculatedDistanceKm = totalDistanceMeters / 1000; // Convert to kilometers

        // Update the distance display
        document.getElementById('distance').value = calculatedDistanceKm.toFixed(2);
        document.getElementById('distance-result').innerText = `Total Distance: ${calculatedDistanceKm.toFixed(2)} km`;

        // Re-perform calculations with new distance
        performCalculations(
            parseFloat(document.getElementById('fuel-efficiency').value),
            document.getElementById('efficiency-unit').value,
            parseFloat(document.getElementById('fuel-price').value),
            document.getElementById('fuel-price-unit').value,
            calculatedDistanceKm,
            'kilometers' // Since we converted to kilometers
        );

        // Update travel time
        displayTravelTime();
    }
}


