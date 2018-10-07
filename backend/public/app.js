const app = {};

// Config
app.config = {
  sessionToken: false
};

// AJAX Client for the restful API
app.client = {};

// Interface for making API calls
app.client.request = (
  headers,
  path,
  method,
  queryStringObject,
  payload,
  callback
) => {
  // Set the defaults
  headers = typeof headers === "object" && headers !== null ? headers : {};
  path = typeof path === "string" ? path : "/";
  method =
    typeof method === "string" &&
    ["POST", "GET", "PUT", "DELETE"].indexOf(method.toUpperCase()) > -1
      ? method.toUpperCase()
      : "GET";
  queryStringObject =
    typeof queryStringObject === "object" && queryStringObject !== null
      ? queryStringObject
      : {};
  payload = typeof payload === "object" && payload !== null ? payload : {};
  callback = typeof callback === "function" ? callback : false;

  // For each query string parameter sent, add it to the path
  let requestUrl = path + "?";
  let counter = 0;
  for (let queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++;
      // If at least one query string parameter has already been added, prepend ampersand
      if (counter > 1) {
        requestUrl += "&";
      }

      requestUrl += queryKey + "=" + queryStringObject[queryKey];
    }
  }

  // From the http request and a JSON type
  let xhr = new XMLHttpRequest();
  xhr.open(method, requestUrl, true);
  xhr.setRequestHeader("Content-type", "application/json");

  // For each header sent, add it to the request
  for (let headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      xhr.setRequestHeader(headerKey, headers[headerKey]);
    }
  }

  // If there is a current session token set, add that as a header
  console.log("SessionToken Check", app.config.sessionToken);
  if (app.config.sessionToken) {
    xhr.setRequestHeader("token", app.config.sessionToken.tokenId);
  }

  // When the request comes back, handl the response
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      let statusCode = xhr.status;
      let responseReturned = xhr.responseText;

      // Callback if requested
      if (callback) {
        try {
          let parsedResponse = JSON.parse(responseReturned);
          callback(statusCode, parsedResponse);
        } catch (err) {
          callback(statusCode, false);
        }
      }
    }
  };

  // Send the payload as JSON
  let payloadString = JSON.stringify(payload);
  xhr.send(payloadString);
};

// Bind the forms
app.bindForms = function() {
  if (document.querySelector("form")) {
    var allForms = document.querySelectorAll("form");
    for (var i = 0; i < allForms.length; i++) {
      allForms[i].addEventListener("submit", function(e) {
        // Stop it from submitting
        e.preventDefault();
        var formId = this.id;
        var path = this.action;
        var method = this.method.toUpperCase();

        // Hide the error message (if it's currently shown due to a previous error)
        document.querySelector("#" + formId + " .formError").style.display =
          "none";

        // Hide the success message (if it's currently shown due to a previous error)
        if (document.querySelector("#" + formId + " .formSuccess")) {
          document.querySelector("#" + formId + " .formSuccess").style.display =
            "none";
        }

        // Turn the inputs into a payload
        var payload = {};
        var elements = this.elements;
        for (var i = 0; i < elements.length; i++) {
          if (elements[i].type !== "submit") {
            // Determine class of element and set value accordingly
            var classOfElement =
              typeof elements[i].classList.value == "string" &&
              elements[i].classList.value.length > 0
                ? elements[i].classList.value
                : "";
            var valueOfElement =
              elements[i].type == "checkbox" &&
              classOfElement.indexOf("multiselect") == -1
                ? elements[i].checked
                : classOfElement.indexOf("intval") == -1
                  ? elements[i].value
                  : parseInt(elements[i].value);
            var elementIsChecked = elements[i].checked;
            // Override the method of the form if the input's name is _method
            var nameOfElement = elements[i].name;
            if (nameOfElement == "_method") {
              method = valueOfElement;
            } else {
              // Create an payload field named "method" if the elements name is actually httpmethod
              if (nameOfElement == "httpmethod") {
                nameOfElement = "method";
              }
              // Create an payload field named "id" if the elements name is actually uid
              if (nameOfElement == "uid") {
                nameOfElement = "id";
              }
              // If the element has the class "multiselect" add its value(s) as array elements
              if (classOfElement.indexOf("multiselect") > -1) {
                if (elementIsChecked) {
                  payload[nameOfElement] =
                    typeof payload[nameOfElement] == "object" &&
                    payload[nameOfElement] instanceof Array
                      ? payload[nameOfElement]
                      : [];
                  payload[nameOfElement].push(valueOfElement);
                }
              } else {
                payload[nameOfElement] = valueOfElement;
              }
            }
          }
        }

        // If the method is DELETE, the payload should be a queryStringObject instead
        var queryStringObject = method == "DELETE" ? payload : {};

        app.client.request(
          undefined,
          path,
          method,
          queryStringObject,
          payload,
          function(statusCode, responsePayload) {
            // Display an error on the form if needed
            if (statusCode !== 200) {
              if (statusCode == 403) {
                // log the user out
                app.logUserOut();
              } else {
                // Try to get the error from the api, or set a default error message
                var error =
                  typeof responsePayload.Error == "string"
                    ? responsePayload.Error
                    : "An error has occured, please try again";

                // Set the formError field with the error text
                document.querySelector(
                  "#" + formId + " .formError"
                ).innerHTML = error;

                // Show (unhide) the form error field on the form
                document.querySelector(
                  "#" + formId + " .formError"
                ).style.display = "block";
              }
            } else {
              // If successful, send to form response processor
              app.formResponseProcessor(formId, payload, responsePayload);
            }
          }
        );
      });
    }
  }
};

// Get session token from local storage
app.getSessionToken = () => {
  const tokenString = localStorage.getItem("token");
  if (typeof tokenString === "string") {
    try {
      const token = JSON.parse(tokenString);
      app.config.sessionToken = token;
      if (typeof token === "object") {
        app.setLoggedInClass = true;
      }
    } catch (e) {
      app.config.sessionToken = false;
      app.setLoggedInClass = false;
    }
  }
};

// Set or remove the Logged in Class from the body
app.setLoggedInClass = add => {
  const target = document.querySelector("body");
  if (add) {
    target.classList.add("loggedIn");
  } else {
    target.classList.remove("loggedIn");
  }
};

// set the Session token in the app config as well as local storage
app.setSessionToken = token => {
  app.config.sessionToken = token;
  const tokenString = JSON.stringify(token);
  localStorage.setItem("token", tokenString);
  if (typeof token === "object") {
    app.setLoggedInClass = true;
  } else {
    app.setLoggedInClass = false;
  }
};

// Form response processor
app.formResponseProcessor = function(formId, requestPayload, responsePayload) {
  var functionToCall = false;
  // If account creation was successful, try to immediately log the user in
  if (formId == "accountCreate") {
    // Take the phone and password, and use it to log the user in
    var newPayload = {
      phone: requestPayload.phone,
      password: requestPayload.password,
      email: requestPayload.email
    };

    app.client.request(
      undefined,
      "api/tokens",
      "POST",
      undefined,
      newPayload,
      function(newStatusCode, newResponsePayload) {
        // Display an error on the form if needed
        if (newStatusCode !== 200) {
          // Set the formError field with the error text
          document.querySelector("#" + formId + " .formError").innerHTML =
            "Sorry, an error has occured. Please try again.";

          // Show (unhide) the form error field on the form
          document.querySelector("#" + formId + " .formError").style.display =
            "block";
        } else {
          // If successful, set the token and redirect the user
          app.setSessionToken(newResponsePayload);
          window.location = "/carts/all";
        }
      }
    );
  }
  // If login was successful, set the token in localstorage and redirect the user
  if (formId == "sessionCreate") {
    app.setSessionToken(responsePayload);
    window.location = "/carts/all";
  }

  // If forms saved successfully and they have success messages, show them
  var formsWithSuccessMessages = ["accountEdit1", "accountEdit2", "cartsEdit1"];
  if (formsWithSuccessMessages.indexOf(formId) > -1) {
    document.querySelector("#" + formId + " .formSuccess").style.display =
      "block";
  }

  // If the user just deleted their account, redirect them to the account-delete page
  if (formId == "accountEdit3") {
    app.logUserOut(false);
    window.location = "/account/deleted";
  }

  // If the user just created a new check successfully, redirect back to the dashboard
  if (formId == "checksCreate") {
    window.location = "/carts/all";
  }

  // If the user just deleted a check, redirect them to the dashboard
  if (formId == "checksEdit2") {
    window.location = "/carts/all";
  }

  if (formId === "placeOrder") {
    window.location = "/menu/view";
  }
};

// Get the session token from localstorage and set it in the app.config object
app.getSessionToken = function() {
  var tokenString = localStorage.getItem("token");
  if (typeof tokenString == "string") {
    try {
      var token = JSON.parse(tokenString);
      app.config.sessionToken = token;
      if (typeof token == "object") {
        app.setLoggedInClass(true);
      } else {
        app.setLoggedInClass(false);
      }
    } catch (e) {
      app.config.sessionToken = false;
      app.setLoggedInClass(false);
    }
  }
};

app.loadDataOnPage = () => {
  // Get the current page from the body class
  var bodyClasses = document.querySelector("body").classList;
  var primaryClass = typeof bodyClasses[0] == "string" ? bodyClasses[0] : false;

  // Logic for menu page
  if (primaryClass == "viewMenu") {
    app.loadMenuPage();
  }

  if (primaryClass == "placeOrder") {
    app.loadOrderPage();
  }

  if (primaryClass == "accountEdit") {
    app.loadAccountEditPage();
  }
};

app.loadOrderPage = () => {
  const phone =
    typeof app.config.sessionToken.phone === "string"
      ? app.config.sessionToken.phone
      : false;
  if (phone) {
    app.client.request(
      undefined,
      "api/menu",
      "GET",
      undefined,
      undefined,
      (statusCode, data) => {
        if (statusCode === 200) {
          const menuData = data;
          const { pizzas, drinks, sides } = menuData;
          const optionsDropDown = document.getElementById("pizzaType");
          let pizzaTypes = "";
          pizzas.forEach(pizza => {
            pizzaTypes += `<option value="${pizza.item}">${
              pizza.item
            }</option>`;
          });
          optionsDropDown.innerHTML = pizzaTypes;
        } else {
          app.logUserOut();
        }
      }
    );
  } else {
    app.logUserOut();
  }
};

app.loadAccountEditPage = () => {
  const phone =
    typeof app.config.sessionToken.phone === "string"
      ? app.config.sessionToken.phone
      : false;
  if (phone) {
    const queryStringObject = {
      phone: phone
    };
    //@TODO add headers here (why don't the headers go in automatically?)
    app.client.request(
      undefined,
      "api/users",
      "GET",
      queryStringObject,
      undefined,
      (statusCode, responsePayload) => {
        if (statusCode === 200) {
          document.querySelector("#accountEdit1 .firstNameInput").value =
            responsePayload.firstName;
          document.querySelector("#accountEdit1 .lastNameInput").value =
            responsePayload.lastName;
          document.querySelector("#accountEdit1 .displayPhoneInput").value =
            responsePayload.phone;
          const hiddenPhoneInputs = document.querySelectorAll(
            "input.hiddenPhoneNumberInput"
          );
          for (let i = 0; i < hiddenPhoneInputs.length; i++) {
            hiddenPhoneInputs[i].value = responsePayload.phone;
          }
        } else {
          app.logUserOut();
        }
      }
    );
  } else {
    app.logUserOut();
  }
};

app.loadMenuPage = () => {
  app.client.request(
    undefined,
    "api/menu",
    "GET",
    undefined,
    undefined,
    (statusCode, data) => {
      if (statusCode === 200) {
        const menuData = data;
        const { pizzas, drinks, sides } = menuData;
        const pizzaTable = document.getElementById("pizzaMenu");
        const drinkTable = document.getElementById("drinkMenu");
        const sidesTable = document.getElementById("sidesMenu");
        pizzas.forEach(pizza => {
          const tr = pizzaTable.insertRow();
          const item = tr.insertCell(0);
          const toppings = tr.insertCell(1);
          const priceSM = tr.insertCell(2);
          const priceMED = tr.insertCell(3);
          const priceLG = tr.insertCell(4);
          item.innerHTML = pizza.item;
          toppings.innerHTML = pizza.toppings.join(", ");
          priceSM.innerHTML = `$${pizza.price.sm}`;
          priceMED.innerHTML = `$${pizza.price.med}`;
          priceLG.innerHTML = `$${pizza.price.lg}`;
        });
        drinks.forEach(drink => {
          const tr = drinkTable.insertRow();
          const item = tr.insertCell(0);
          const price = tr.insertCell(1);
          item.innerHTML = drink.item;
          price.innerHTML = `$${drink.price}`;
        });
        sides.forEach(side => {
          const tr = sidesTable.insertRow();
          const item = tr.insertCell(0);
          const price = tr.insertCell(1);
          item.innerHTML = side.item;
          price.innerHTML = `$${side.price}`;
        });
      } else {
        app.logUserOut(); // @TODO elaborate and send the person to a logged out page which gives an error message.
      }
    }
  );
};

// Bind the logout button
app.bindLogoutButton = () => {
  document.getElementById("logoutButton").addEventListener("click", e => {
    // Stop it from redirecting anywhere
    e.preventDefault();

    // Log the user out
    app.logUserOut();
  });
};

// Log the user out then redirect them
app.logUserOut = redirectUser => {
  console.log("logging User Out");
  // Set redirectUser to default to true
  redirectUser = typeof redirectUser == "boolean" ? redirectUser : true;

  // Get the current token id
  var tokenId =
    typeof app.config.sessionToken.id == "string"
      ? app.config.sessionToken.id
      : false;

  // Send the current token to the tokens endpoint to delete it
  var queryStringObject = {
    id: tokenId
  };
  app.client.request(
    undefined,
    "api/tokens",
    "DELETE",
    queryStringObject,
    undefined,
    function(statusCode, responsePayload) {
      // Set the app.config token as false
      app.setSessionToken(false);

      // Send the user to the logged out page
      if (redirectUser) {
        window.location = "/session/deleted";
      }
    }
  );
};

// Renew the token
app.renewToken = callback => {
  var currentToken =
    typeof app.config.sessionToken == "object"
      ? app.config.sessionToken
      : false;
  if (currentToken) {
    // Update the token with a new expiration
    var payload = {
      id: currentToken.tokenId,
      extend: true
    };
    app.client.request(
      undefined,
      "api/tokens",
      "PUT",
      undefined,
      payload,
      function(statusCode, responsePayload) {
        // Display an error on the form if needed
        if (statusCode == 200) {
          // Get the new token details
          var queryStringObject = { id: currentToken.tokenId };
          app.client.request(
            undefined,
            "api/tokens",
            "GET",
            queryStringObject,
            undefined,
            function(statusCode, responsePayload) {
              // Display an error on the form if needed
              if (statusCode == 200) {
                app.setSessionToken(responsePayload);
                callback(false);
              } else {
                app.setSessionToken(false);
                callback(true);
              }
            }
          );
        } else {
          app.setSessionToken(false);
          callback(true);
        }
      }
    );
  } else {
    app.setSessionToken(false);
    callback(true);
  }
};

app.tokenRenewalLoop = () => {
  setInterval(() => {
    app.renewToken(err => {
      if (!err) {
        console.log("Token renewed successfully @" + Date.now());
      }
    });
  }, 1000 * 60);
};

// Init (bootstrapping)
app.init = () => {
  app.bindForms();
  app.bindLogoutButton();
  app.getSessionToken();
  app.tokenRenewalLoop();
  app.loadDataOnPage();
};

// Call the init processes after the window loads
window.onload = () => {
  app.init();
};
