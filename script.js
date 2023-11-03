'use strict';

class Workout {
  date = new Date();
  id = Date.now() + ''.slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lan,lon]
    this.distance = distance; // in km
    this.duration = duration; // in mins
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
    console.log(this);
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const run1 = new Running([39, -12], 5.2, 24, 178);
const cycling1 = new Cycling([39, -12], 27, 98, 200);
// console.log(run1, cycling1);
// --------------------------------------
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortEl = document.getElementById('sort');

class App {
  #map;
  #editMode;
  #idToChangeOrRemove;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = {};
  #sortDistance;
  #sortDuration;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attached event handlers
    this._newWorkout = this._newWorkout.bind(this);
    this._editWorkout = this._editWorkout.bind(this);
    this._moveToPopup = this._moveToPopup.bind(this);
    this._sort = this._sort.bind(this);
    form.addEventListener('submit', this._newWorkout);
    sortEl.addEventListener('click', this._sort);
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup);
  }

  _getPosition() {
    if (navigator.geolocation)
      // for old browsers, first check geolocation api exists
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    // console.log(position.coords);

    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel); // the number here is the zoom level
    // console.log(this.#map);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();

    // If user clicked the map, clear the form to add new workout
    if (this.#mapEvent) {
      // Remove the edit event listener and add back the original new workout event listener
      form.removeEventListener('submit', this._editWorkout);
      form.addEventListener('submit', this._newWorkout);

      this.#editMode = false;
      this.#idToChangeOrRemove = null;

      console.log(
        `ADD NEW mode activated. 'this.#editMode' variable is now set to: ${
          this.#editMode
        }. Workout ID should now be null: ${this.#idToChangeOrRemove}.`
      );
      // clear the form fields
      return this._hideForm(true);
    }
  }

  _showEditWorkoutForm(e) {
    form.removeEventListener('submit', this._newWorkout);

    // Find the ID of the clicked workout
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    this.#idToChangeOrRemove = workoutEl.dataset.id;
    this.#editMode = true;
    console.log(
      `EDIT mode activated. 'this.#editMode' variable is now set to: ${
        this.#editMode
      }. Workout ID to edit: ${this.#idToChangeOrRemove}.`
    );

    this._showForm(null, this.#idToChangeOrRemove);

    // Find the right element from the workouts array
    const existingWorkoutData = this.#workouts.find(
      work => work.id === this.#idToChangeOrRemove
    );

    // Fill in the form fields with the existing data from array
    if (inputType.value !== existingWorkoutData.type) {
      this._toggleElevationField();
    }
    inputType.value = existingWorkoutData.type;
    inputDistance.value = existingWorkoutData.distance;
    inputDuration.value = existingWorkoutData.duration;
    inputCadence.value = existingWorkoutData.cadence;
    inputElevation.value = existingWorkoutData.elevationGain;

    // add the edit event listener
    form.addEventListener('submit', this._editWorkout);
  }

  _hideForm(clearOnly) {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    if (clearOnly) return;

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(function () {
      form.style.display = 'grid';
    }, 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _validateInputs(lat, lng) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    let workout;
    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');
      workout = this.#editMode
        ? {
            type: type,
            distance: distance,
            duration: duration,
            cadence: cadence,
          }
        : new Running([lat, lng], distance, duration, cadence);
    }
    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevationGain = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevationGain) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');
      workout = this.#editMode
        ? {
            type: type,
            distance: distance,
            duration: duration,
            elevationGain: elevationGain,
          }
        : new Cycling([lat, lng], distance, duration, elevationGain);
    }
    return workout;
  }

  _newWorkout(e) {
    e.preventDefault();

    const { lat, lng } = this.#mapEvent.latlng;
    let workout = this._validateInputs(lat, lng);

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + Clear input fields
    this._hideForm();

    // unbold any sort options
    document.getElementById('duration').style.fontWeight = '400';
    document.getElementById('distance').style.fontWeight = '400';

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _findIndexOfId(data) {
    // find the ID in the array
    return data.findIndex(item => item.id === this.#idToChangeOrRemove);
  }

  _editWorkout(e) {
    e.preventDefault();
    console.log('EDIT. The ID to edit is:', this.#idToChangeOrRemove);

    // get local storage
    const data = JSON.parse(localStorage.getItem('workouts'));

    const idToReplace = this._findIndexOfId(data);
    console.log(data);

    const validatedWorkout = this._validateInputs();
    if (!validatedWorkout) return;
    // Update values
    this.#workouts[idToReplace].type = inputType.value;
    this.#workouts[idToReplace].distance = +inputDistance.value;
    this.#workouts[idToReplace].duration = +inputDuration.value;

    if (inputType.value === 'running') {
      this.#workouts[idToReplace].cadence = +inputCadence.value;
    }
    if (inputType.value === 'cycling') {
      this.#workouts[idToReplace].elevationGain = +inputElevation.value;
    }

    // Hide form + Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Remove workouts from sidebar
    document.querySelectorAll('.workout').forEach(el => el.remove());

    // render workouts list
    this._getLocalStorage();

    // unbold any sort options
    document.getElementById('duration').style.fontWeight = '400';
    document.getElementById('distance').style.fontWeight = '400';

    // Remove the edit event listener and add back the original new workout event listener
    form.removeEventListener('submit', this._editWorkout);
    form.addEventListener('submit', this._newWorkout);
  }

  _renderWorkoutMarker(workout) {
    // Create a marker for the workout
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴'} ${workout.description}`
      )
      .openPopup();

    // Store the marker in the markers object using the workout's ID as the key
    this.#markers[workout.id] = marker;
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}"> 

          <h2 class="workout__title">${workout.description}</h2>
          <div>
          <div class="edit"><span >🛠️</span></div>
          <div class="deleteWorkout"><span id='delete'>❌</span></div>
        </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃' : '🚴'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;
    if (workout.type === 'running') {
      html += `   <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    }

    if (workout.type === 'cycling') {
      html += `   <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
  </li> `;
    }

    form.insertAdjacentHTML('afterend', html);

    const edit = document.querySelector('.edit');
    edit.addEventListener('click', this._showEditWorkoutForm.bind(this));

    const deleteWorkout = document.querySelector('.deleteWorkout');
    deleteWorkout.addEventListener('click', this._deleteWorkout.bind(this));
  }

  _moveToPopup(e) {
    if (e.target.id === 'delete') return;

    const workoutEl = e.target.closest('.workout');
    // console.log('HERE', workoutEl);
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workout);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    // using the public interface
    // workout.click();
  }

  _sort(e) {
    const data = JSON.parse(localStorage.getItem('workouts'));

    const updateSidebar = () => {
      // Set local storage to all workouts
      this._setLocalStorage();

      // Remove workouts from sidebar
      document.querySelectorAll('.workout').forEach(el => el.remove());

      // render workouts list
      this._getLocalStorage();
    };

    if (e?.target.textContent === 'DISTANCE') {
      document.getElementById('duration').style.fontWeight = '400';
      document.getElementById('distance').style.fontWeight = '700';
      if (this.#sortDistance) {
        const sortedByDistance = data.toSorted(
          (a, b) => b.distance - a.distance
        );
        this.#workouts = sortedByDistance;
        this.#sortDistance = false;
        return updateSidebar();
      }
      if (!this.#sortDistance) {
        const sortedByDistance = data.toSorted(
          (a, b) => a.distance - b.distance
        );
        this.#workouts = sortedByDistance;
        this.#sortDistance = true;
        return updateSidebar();
      }
    }

    if (e?.target.textContent === 'DURATION') {
      document.getElementById('duration').style.fontWeight = '700';
      document.getElementById('distance').style.fontWeight = '400';
      if (this.#sortDuration) {
        const sortedByDuration = data.toSorted(
          (a, b) => b.duration - a.duration
        );
        this.#workouts = sortedByDuration;
        this.#sortDuration = false;
        return updateSidebar();
      }
      if (!this.#sortDuration) {
        const sortedByDuration = data.toSorted(
          (a, b) => a.duration - b.duration
        );
        this.#workouts = sortedByDuration;
        this.#sortDuration = true;
        return updateSidebar();
      }
    }
  }

  _deleteWorkout(e) {
    containerWorkouts.removeEventListener('click', this._moveToPopup);
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    this.#idToChangeOrRemove = workoutEl.dataset.id;

    // Get the marker associated with the workout
    const marker = this.#markers[this.#idToChangeOrRemove];

    // Remove the marker from the map
    if (marker) {
      // this.#map.closePopup();
      this.#map.removeLayer(marker);
    }

    // Remove the workout from the array
    const data = JSON.parse(localStorage.getItem('workouts'));
    const index = this._findIndexOfId(data);
    this.#workouts.splice(index, 1);

    // Set local storage to all workouts
    this._setLocalStorage();

    // Remove workouts from sidebar
    document.querySelectorAll('.workout').forEach(el => el.remove());

    // Render items
    this._getLocalStorage();

    containerWorkouts.addEventListener('click', this._moveToPopup);
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this._sort();
    this.#workouts = data;
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
