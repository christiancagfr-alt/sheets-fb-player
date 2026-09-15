const DEFAULTS = {
  enabled: true,
  playOnSelect: true,
  playOnHover: true,
  hoverDelayMs: 450,
  closeOnOtherCell: true,
  playerMode: "overlay",
};

const fields = [
  { id: "enabled", type: "bool" },
  { id: "playOnSelect", type: "bool" },
  { id: "playOnHover", type: "bool" },
  { id: "closeOnOtherCell", type: "bool" },
  { id: "playerMode", type: "select" },
  { id: "hoverDelayMs", type: "number" },
];

function readForm() {
  const data = {};
  fields.forEach(function (field) {
    const el = document.getElementById(field.id);
    if (field.type === "bool") data[field.id] = el.checked;
    else if (field.type === "number") data[field.id] = Number(el.value) || 0;
    else data[field.id] = el.value;
  });
  return data;
}

function fillForm(stored) {
  const data = Object.assign({}, DEFAULTS, stored || {});
  fields.forEach(function (field) {
    const el = document.getElementById(field.id);
    if (field.type === "bool") el.checked = !!data[field.id];
    else el.value = data[field.id];
  });
}

chrome.storage.sync.get(DEFAULTS, fillForm);

fields.forEach(function (field) {
  document.getElementById(field.id).addEventListener("change", function () {
    chrome.storage.sync.set(readForm());
  });
});
