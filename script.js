let startAutocomplete;
let endAutocomplete;
let stopAutocompletes = [];
let stopCount = 0;
let map;
let directionsService;
let directionsRenderer;

function initMap() {
    // Initialize the map centered on the UK
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 54.505, lng: -2.09 }, // Approximate center of the UK
        zoom: 6, // Adjust zoom level to show the UK
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    // Initialize autocomplete for start and end locations
    startAutocomplete = new google.maps.places.Autocomplete(document.getElementById('start-location'), {
        types: ['geocode'],
    });
    endAutocomplete = new google.maps.places.Autocomplete(document.getElementById('end-location'), {
        types: ['geocode'],
    });

    // Add event listener to dynamically add stops
    document.getElementById('add-stop-btn').addEventListener('click', addStopField);

    // Event listener for the Calculate button
    document.getElementById('calculate-btn').addEventListener('click', calculate);

    // Event listener for the theme switch
    document.getElementById('theme-switch').addEventListener('change', toggleTheme);
}

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

    // Add this autocomplete to the list of stop autocompletes
    stopAutocompletes.push(stopAutocomplete);
}

function showLoadingSpinner() {
    document.getElementById('loading-spinner').style.display = 'block';
}

function hideLoadingSpinner() {
    document.getElementById('loading-spinner').style.display = 'none';
}

function displayError(message) {
    document.getElementById('error-message').innerText = message;
}

function clearError() {
    document.getElementById('error-message').innerText = '';
}

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

    return true;
}

function calculate() {
    // Clear previous errors and show loading spinner
    clearError();
    if (!validateInputs()) return;
    showLoadingSpinner();

    const fuelEfficiency = parseFloat(document.getElementById('fuel-efficiency').value);
    const fuelEfficiencyUnit = document.getElementById('efficiency-unit').value;

    const fuelPrice = parseFloat(document.getElementById('fuel-price').value);
    const fuelPriceUnit = document.getElementById('fuel-price-unit').value;

    const distanceUnit = document.getElementById('distance-unit').value;

    const startPlace = startAutocomplete.getPlace();
    const endPlace = endAutocomplete.getPlace();

    // Collect waypoints (additional stops)
    const waypoints = stopAutocompletes.map(stop => {
        const place = stop.getPlace();
        return place ? { location: place.formatted_address, stopover: true } : null;
    }).filter(Boolean);

    if (startPlace && endPlace) {
        const startLocation = startPlace.formatted_address;
        const endLocation = endPlace.formatted_address;

        // Call the function to calculate distance, passing the unit (miles or kilometers)
        calculateDistance(startLocation, endLocation, waypoints, distanceUnit)
            .then((calculatedDistance) => {
                const distanceInput = document.getElementById('distance');
                
                // Update the displayed distance based on the selected unit
                if (distanceUnit === 'miles') {
                    distanceInput.value = calculatedDistance.toFixed(2); // Display in miles
                } else {
                    distanceInput.value = (calculatedDistance * 1.60934).toFixed(2); // Display kilometers if needed
                }

                // Perform cost and emissions calculations
                performCalculations(fuelEfficiency, fuelEfficiencyUnit, fuelPrice, fuelPriceUnit, calculatedDistance, distanceUnit);

                // Hide loading spinner
                hideLoadingSpinner();
            })
            .catch((error) => {
                hideLoadingSpinner();
                displayError('Error calculating distance: ' + error);
            });
    } else {
        hideLoadingSpinner();
        displayError('Please select valid start and end locations.');
    }
}

function calculateDistance(start, end, waypoints, distanceUnit) {
    return new Promise((resolve, reject) => {
        directionsService.route(
            {
                origin: start,
                destination: end,
                waypoints: waypoints,
                travelMode: 'DRIVING',
            },
            (response, status) => {
                if (status === 'OK') {
                    directionsRenderer.setDirections(response);
                    const route = response.routes[0];
                    let totalDistanceMeters = 0;

                    // Sum up the distances of each leg in meters
                    route.legs.forEach(leg => {
                        totalDistanceMeters += leg.distance.value; // distance.value is in meters
                    });

                    // Convert meters to miles or kilometers based on the selected unit
                    if (distanceUnit === 'miles') {
                        const distanceInMiles = totalDistanceMeters / 1609.34; // Convert meters to miles
                        resolve(distanceInMiles); // Return the distance in miles
                    } else {
                        const distanceInKilometers = totalDistanceMeters / 1000; // Convert meters to kilometers
                        resolve(distanceInKilometers); // Return the distance in kilometers
                    }
                } else {
                    reject(status);
                }
            }
        );
    });
}

function performCalculations(fuelEfficiency, efficiencyUnit, fuelPrice, priceUnit, distance, distanceUnit) {
    // Convert all units to standard (kilometers, liters)
    let distanceKm;
    if (distanceUnit === 'miles') {
        distanceKm = distance * 1.60934; // Convert miles to kilometers
    } else {
        distanceKm = distance; // Use kilometers as is
    }

    let kpl; // kilometers per liter (standardized unit)
    if (efficiencyUnit === 'mpg') {
        kpl = fuelEfficiency * 0.354006; // Convert MPG to KPL (1 MPG ≈ 0.354006 KPL)
    } else {
        kpl = 100 / fuelEfficiency; // Convert L/100km to KPL (fuelEfficiency is in L/100km)
    }

    let fuelPricePerLiter;
    if (priceUnit === 'pence_per_liter') {
        fuelPricePerLiter = fuelPrice / 100; // Convert pence to pounds
    } else {
        const litersPerGallon = 4.54609; // Convert UK gallons to liters
        fuelPricePerLiter = (fuelPrice / 100) / litersPerGallon; // Convert pence per gallon to pounds per liter
    }

    // Calculate the number of liters needed based on the distance in kilometers and fuel efficiency in KPL
    const litersNeeded = distanceKm / kpl;

    // Calculate total cost in £
    const totalCost = litersNeeded * fuelPricePerLiter;

    // CO₂ emissions (average 2.31 kg CO₂ per liter of petrol)
    const emissions = litersNeeded * 2.31;

    // Update the DOM with the results
    document.getElementById('cost-result').innerText = `Total Cost: £${totalCost.toFixed(2)}`;
    document.getElementById('emissions-result').innerText = `Estimated CO₂ Emissions: ${emissions.toFixed(2)} kg`;
    document.getElementById('distance-result').innerText = `Total Distance: ${distanceKm.toFixed(2)} km`;
}

function toggleTheme() {
    const isChecked = document.getElementById('theme-switch').checked;
    const body = document.body;
    const themeLabel = document.getElementById('theme-label');

    if (isChecked) {
        body.classList.add('dark-mode');
        themeLabel.innerText = 'Dark Mode';
    } else {
        body.classList.remove('dark-mode');
        themeLabel.innerText = 'Light Mode';
    }
}
