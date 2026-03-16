/**
 * Prevent default context menu and focus canvas on click and mouseenter.
 * @param {Event} event 
 */
function handleEvent(event) {
  if (event.type === "contextmenu") {
    event.preventDefault();
  } else if (event.type === "click" || event.type === "mouseenter") {
    event.currentTarget.focus();
  }
}

const eventTypes = ["contextmenu", "click", "mouseenter"];

/**
 * Add event listeners to the canvas element to prevent default context menu and focus canvas on click and mouseenter.
 * @param {HTMLCanvasElement} canvas 
 */
export function addCanvasEventListeners(canvas) {
  if (!canvas) {
    return;
  }
  eventTypes.forEach(eventType => canvas.addEventListener(eventType, handleEvent));
}

/**
 * Remove event listeners that were installed in `addCanvasEventListeners`.
 * @param {HTMLCanvasElement} canvas 
 */
export function removeCanvasEventListeners(canvas) {
  if (!canvas) {
    return;
  }
  eventTypes.forEach(eventType => canvas.removeEventListener(eventType, handleEvent));
}
