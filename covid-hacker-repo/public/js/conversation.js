// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/

var ConversationPanel = (function() {
  var settings = {
    selectors: {
      chatBox: '#scrollingChat',
      fromUser: '.from-user',
      fromWatson: '.from-watson',
      latest: '.latest'
    },
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };

  // Publicly accessible methods defined
  return {
    init: init,
    inputKeyDown: inputKeyDown,
    submitInput: submitInput,
    checkSubmitBtn: checkSubmitBtn,
    sendMessage: sendMessage
  };

  // Initialize the module
  function init() {
    chatUpdateSetup();
    let context = {};
    context.name = 'Test Doctor 1';
    context.testvar = 'IBM';
    Api.sendRequest('', context);
    setupInputBox();
  }
  // Set up callbacks on payload setters in Api module
  // This causes the displayMessage function to be called when messages are sent / received
  function chatUpdateSetup() {
    var currentRequestPayloadSetter = Api.setRequestPayload;
    Api.setRequestPayload = function(newPayloadStr) {
      currentRequestPayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setResponsePayload;
    Api.setResponsePayload = function(newPayloadStr) {
      currentResponsePayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
    };
  }

  // Set up the input box to underline text as it is typed
  // This is done by creating a hidden dummy version of the input box that
  // is used to determine what the width of the input text should be.
  // This value is then used to set the new width of the visible input box.
  function setupInputBox() {
    var input = document.getElementById('textInput');
    var dummy = document.getElementById('textInputDummy');
    var minFontSize = 14;
    var maxFontSize = 16;
    var minPadding = 4;
    var maxPadding = 6;

    // If no dummy input box exists, create one
    if (dummy === null) {
      var dummyJson = {
        tagName: 'div',
        attributes: [
          {
            name: 'id',
            value: 'textInputDummy'
          }
        ]
      };

      dummy = Common.buildDomElement(dummyJson);
      document.body.appendChild(dummy);
    }

    function adjustInput() {
      if (input.value === '') {
        // If the input box is empty, remove the underline
        input.classList.remove('underline');
        input.setAttribute('style', 'width:' + '100%');
        input.style.width = '100%';
      } else {
        // otherwise, adjust the dummy text to match, and then set the width of
        // the visible input box to match it (thus extending the underline)
        input.classList.add('underline');
        var txtNode = document.createTextNode(input.value);
        [
          'font-size',
          'font-style',
          'font-weight',
          'font-family',
          'line-height',
          'text-transform',
          'letter-spacing'
        ].forEach(function(index) {
          dummy.style[index] = window
            .getComputedStyle(input, null)
            .getPropertyValue(index);
        });
        dummy.textContent = txtNode.textContent;

        var padding = 0;
        var htmlElem = document.getElementsByTagName('html')[0];
        var currentFontSize = parseInt(
          window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'),
          10
        );
        if (currentFontSize) {
          padding = Math.floor(
            ((currentFontSize - minFontSize) / (maxFontSize - minFontSize)) *
              (maxPadding - minPadding) +
              minPadding
          );
        } else {
          padding = maxPadding;
        }

        var widthValue = dummy.offsetWidth + padding + 'px';
        input.setAttribute('style', 'width:' + widthValue);
        input.style.width = widthValue;
      }
    }

    // Any time the input changes, or the window resizes, adjust the size of the input box
    input.addEventListener('input', adjustInput);
    window.addEventListener('resize', adjustInput);

    // Trigger the input event once to set up the input box and dummy element
    Common.fireEvent(input, 'input');
  }

  // Display a user or Watson message that has just been sent/received
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
    var textExists =
      (newPayload.input && newPayload.input.text) ||
      (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
      // Create new message DOM element
      var messageDivs = buildMessageDomElements(newPayload, isUser);
      var chatBoxElement = document.querySelector(settings.selectors.chatBox);
      var previousLatest = chatBoxElement.querySelectorAll(
        (isUser ? settings.selectors.fromUser : settings.selectors.fromWatson) +
          settings.selectors.latest
      );
      // Previous "latest" message is no longer the most recent
      if (previousLatest) {
        Common.listForEach(previousLatest, function(element) {
          element.classList.remove('latest');
        });
      }

      messageDivs.forEach(function(currentDiv) {
        chatBoxElement.appendChild(currentDiv);
        // Class to start fade in animation
        currentDiv.classList.add('load');
      });
      // Move chat to the most recent messages when new messages are added
      scrollToChatBottom();
    }
  }

  // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Constructs new DOM element from a message payload
  function buildMessageDomElements(newPayload, isUser) {
    var genericArr = [];

    if (isUser) {
      genericArr.push(newPayload.input);
    } else {
      // var outMsg = { index: 0, html: '' };
      if (newPayload.hasOwnProperty('output')) {
        if (newPayload.output.hasOwnProperty('generic')) {
          var options = null;
          for (var i = 0; i < newPayload.output.generic.length; i++) {
            if (newPayload.output.generic[i].response_type === 'text') {
              console.log(escape(newPayload.output.generic[i].text));
              textArr = escape(newPayload.output.generic[i].text).split('%0A');
              textArr.forEach(function(text) {
                genericArr.push({
                  response_type: 'text',
                  text: unescape(text)
                });
              });
            } else if (
              newPayload.output.generic[i].response_type === 'option'
            ) {
              var optionsObj = newPayload.output.generic[i];
              var options = optionsObj.options;
              optionsObj.html = '<ul>';
              for (j = 0; j < options.length; j++) {
                if (options[j].value) {
                  optionsObj.html +=
                    '<li><div class="button-options" onclick="ConversationPanel.sendMessage(\'' +
                    options[j].value.input.text +
                    '\');" >' +
                    options[j].label +
                    '</div></li>';
                }
              }
              optionsObj.html += '</ul>';
              genericArr.push(optionsObj);
            }
          }
        }
      }
    }

    var messageArray = [];

    var messageJson = {
      tagName: 'div',
      classNames: ['segments'],
      children: [
        {
          tagName: 'div',
          classNames: [isUser ? 'from-user' : 'from-watson', 'latest', 'top'],
          children: []
        }
      ]
    };

    if (!isUser) {
      messageJson.children.unshift({
        tagName: 'i',
        classNames: ['chatbot-icon']
      });
    }
    genericArr.forEach(function(currentObj) {
      if (isUser) {
        if (currentObj) {
          if (currentObj.text.indexOf('<br>') === 0) {
            currentObj.text = currentObj.text.replace('<br>', '');
          }
          messageJson.children[messageJson.children.length - 1].children.push({
            // <div class='message-inner'>
            tagName: 'div',
            classNames: ['message-inner'],
            children: [
              {
                // <p>{messageText}</p>
                tagName: 'p',
                text: currentObj.text
              }
            ]
          });
        }
      } else {
        if (currentObj) {
          if (currentObj.response_type === 'text') {
            if (currentObj.text.indexOf('<br>') === 0) {
              currentObj.text = currentObj.text.replace('<br>', '');
            }
            messageJson.children[messageJson.children.length - 1].children.push(
              {
                tagName: 'div',
                classNames: ['message-inner'],
                children: [
                  {
                    tagName: 'p',
                    text: currentObj.text
                  }
                ]
              }
            );
          } else if (currentObj.response_type === 'option') {
            var childrenLength =
              messageJson.children[messageJson.children.length - 1].children
                .length;
            if (currentObj.html !== '') {
              messageJson.children[messageJson.children.length - 1].children[
                childrenLength - 1
              ].children.push({
                tagName: 'div',
                classNames: ['options-container'],
                text: currentObj.html
              });
            }
          }
        }
      }
    });

    messageArray.push(Common.buildDomElement(messageJson));
    return messageArray;
  }

  // Scroll to the bottom of the chat window (to the most recent messages)
  // Note: this method will bring the most recent user message into view,
  //   even if the most recent message is from Watson.
  //   This is done so that the "context" of the conversation is maintained in the view,
  //   even if the Watson message is long.
  function scrollToChatBottom() {
    var scrollingChat = document.querySelector('#scrollingChat');

    // Scroll to the latest message sent by the user
    var scrollEl = scrollingChat.querySelector(
      settings.selectors.fromUser + settings.selectors.latest
    );
    if (scrollEl) {
      scrollingChat.scrollTop = scrollEl.offsetTop;
    }
  }

  function sendMessage(text) {
    if (text) {
      // Retrieve the context from the previous server response
      var context;
      var latestResponse = Api.getResponsePayload();
      if (latestResponse) {
        context = latestResponse.context;
      }

      text = strip_html_tags(text);
      // Send the user message
      Api.sendRequest(text, context);
    }
  }

  function strip_html_tags(str) {
    if (str === null || str === '') return false;
    else str = str.toString();
    return str.replace(/<[^>]*>/g, '');
  }

  // Handles the submission of input
  function inputKeyDown(event, inputBox) {
    // Submit on enter key, dis-allowing blank messages
    if (event.keyCode === 13 && inputBox.value) {
      if (inputBox.value.trim() !== '') {
        sendMessage(inputBox.value.trim());
        // Clear input box for further messages
        inputBox.value = '';
        $('.submit-msg').attr('disabled', true);
        Common.fireEvent(inputBox, 'input');
      } else {
        inputBox.value = '';
        $('.submit-msg').attr('disabled', true);
        Common.fireEvent(input, 'input');
      }
    }
  }

  function checkSubmitBtn(event) {
    var textinput_value = $('#textInput').val();
    if (textinput_value != '') {
      $('.submit-msg').attr('disabled', false);
    } else {
      $('.submit-msg').attr('disabled', true);
    }
  }
  // Handles the submission of input
  function submitInput(event, inputBoxID) {
    var input = document.getElementById(inputBoxID);
    if (input.value.trim() !== '') {
      sendMessage(input.value.trim());
      // Clear input box for further messages
      input.value = '';
      $('.submit-msg').attr('disabled', true);
      Common.fireEvent(input, 'input');
    } else {
      input.value = '';
      $('.submit-msg').attr('disabled', true);
      Common.fireEvent(input, 'input');
    }
  }
})();
