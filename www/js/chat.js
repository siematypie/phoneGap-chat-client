$.connection.hub.url = 'http://theultimatechat.azurewebsites.net/signalr';

if (/Android/.test(navigator.appVersion)) {
    $('input[type="text"]').attr('autocomplete', "off");
}

var imgid = 0;
var chat = $.connection.chatHub;
var filesender;
var username;
var messageBoard = $("#message-board");
var nicknameWell = $('#nickname-well');
var preventOnScroll = false;
var autoScrollingEnabled = true;
var $currentWindow = $();
var previousMessageBatchRecieved = false;
var messageBatchLength = 15;
var anchormeConfig = {
    emails: false,
    ips: false,
    attributes:
    [
        {
            name: "target",
            value: "_blank"
        },
        function (urlObj) {
            if (urlObj.protocol === "mailto:") return { name: "class", value: "email-link" };
            return { name: "class", value: "link" }
        }
    ]
}
var mb = 1048576;
var map = {
    "<3": "\u2764\uFE0F",
    "</3": "\uD83D\uDC94",
    ":D": "\uD83D\uDE00",
    ":)": "\uD83D\uDE03",
    ";)": "\uD83D\uDE09",
    ":(": "\uD83D\uDE12",
    ":p": "\uD83D\uDE1B",
    ";p": "\uD83D\uDE1C",
    ";(": "\uD83D\uDE22",
};

function escapeSpecialChars(regex) {
    return regex.replace(/([()[{*+.$^\\|?])/g, '\\$1');
}


document.addEventListener("deviceready", onDeviceReady, true);
function onDeviceReady(){
 //once device is ready
     $("#photo").click(function(e){
       stopDefault(e);
       navigator.camera.getPicture(onSuccess, onFail, { quality: 50,
         destinationType: Camera.DestinationType.FILE_URI });

         function onSuccess(imageURI) {
           sendPhoneResource(imageURI);
         }

         function onFail(message) {
             console.log('Failed because: ' + message);
         }
     });

     $("#video").click(function(e){
       stopDefault(e);
       var options = { limit: 1, quality: 0 };

       navigator.device.capture.captureVideo(
         function(mediaFiles) {
           sendPhoneResource(mediaFiles[0].fullPath);
        }, captureError, options
       );

       var captureError = function(error) {
           alert('Error code: ' + error.code, null, 'Capture Error');
       };

     });

     $("#audio").click(function(e){
       stopDefault(e);
       var options = { limit: 1};

       navigator.device.capture.captureAudio(
         function(mediaFiles) {
           sendPhoneResource(mediaFiles[0].fullPath);
        }, captureError, options
       );

       var captureError = function(error) {
           alert('Error code: ' + error.code, null, 'Capture Error');
       };
     });

     $('#messages').on('click', '.download-button', function () {

           var fail = function (message) {
             swal({
                 type: 'error',
                 title: 'Error!',

                 timer: 1500
             });
           }
           var success = function (data) {
             swal({
                 type: 'success',
                 title: 'Your download has started!',
                 timer: 1500
             });
           }
           cordova.plugins.DownloadManager.download($(this).attr("href"), success, fail);
     });

     $('#header-content').on('click', '.download-button', function () {
           var fail = function (message) {
              alert(message)
           }
           var success = function (data) {
                  console.log("succes");
           }
           cordova.plugins.DownloadManager.download($(this).attr("href"), success, fail);
     });

     $('#messages').on('click', '.link', function (e) {
         stopDefault(e);
         cordova.InAppBrowser.open($(this).attr('href'), '_blank', 'location=yes');
     });

}

function sendPhoneResource(fullPath){
    window.resolveLocalFileSystemURL(fullPath, function (fileEntry) {
    fileEntry.file(function (file) {
        filesender = new FileSender(file);
        filesender.broadcastFile();
    });
    }, function (error) {
    console.log(error)
    });
}

$("#file-browser").click(function(e){
 stopDefault(e);
 $("#myFile").click();
})

$("#myFile").change(function(){
   var files = this.files
   if (files.length === 1){
     filesender = new FileSender(files[0]);
     filesender.broadcastFile();
   }
});

 $.fn.showAsCurrent = function () {
     if ($(this).selector !== $currentWindow.selector) {
         console.log($currentWindow);
         console.log($(this));
         $currentWindow.hide();
         this.fadeIn(500);
         $currentWindow = $(this);
     }
 };

 $('#btn-connect').click(function () {
     var username = $('#nickname').val();
     var identity = new Identity();
     if (!identity.isValid && username) {
         chat.server.notify(new NewIdentity(username));
     }
 });

 $("#message-form").submit(function (e) {
     stopDefault(e)
 });

 $('#nickname').on('keyup',
     function (e) {
         if (e.which === 13 && $('#nickname').val()) {

             $('#btn-connect').click();
         }

         if ($('#nickname').val()) {
             $('#btn-connect').fadeIn(500);
         } else {
             $('#btn-connect').fadeOut(200);
         }
     });

 $('#messages').on('click', 'img.enlarge-img', function () {
     var img = $(this).clone();
     var link = "<a href='" +
         img.attr('src') +
         "' class='btn btn-default pull-left download-button' download>" +
         "<span class='glyphicon glyphicon-floppy-save'></span>" +
         "</a>";
     $("#modal-title").html($(img).data("name"));
     $("#header-content").html(link);
     img.removeClass("enlarge-img");
     $('#modal-body').html(img);
     $('#myModal').modal('show');
 });


 function pageStart() {
     var identity = new Identity();
     if (identity.isValid) {
         chat.server.notify(identity);
     }
     else {
         nicknameWell.showAsCurrent();
         connectIfHaveToken();
     }
 }

 function connectIfHaveToken() {
     var identity = new Identity();
     if (identity.isValid && nicknameWell.selector === $currentWindow.selector) {
         chat.server.notify(identity);
     } else if (!identity.isValid) {
         setTimeout(connectIfHaveToken, 1000);
     }
 }


 messageBoard.scroll(function () {
       if ($(this).scrollTop() < 1 && previousMessageBatchRecieved) {
          var oldestMessageDate = $("#oldest-message").val();
          chat.server.getOlderMessages(oldestMessageDate, new Identity());
          previousMessageBatchRecieved = false;
      }

     if (preventOnScroll) {
         preventOnScroll = false;
         return;
     }

     if (!messageBoard.scrolledToBottom()) {
         autoScrollingEnabled = false;
     } else {
         autoScrollingEnabled = true;
     }

 });

 function usernameUpdate(userList) {
     var users = "";
     userList.forEach(function (name) {
         users += "<li>" + name + "</li>";
     });

     $('#logged-users').html(users);
 }


 chat.client.differentName = function () {
     var token = localStorage.getItem('token');
     var name = localStorage.getItem('name');
     localStorage.clear();

     if (name && token) {
         errorAlert("Sorry, but your previous username " + name + " has already been taken by someone else. Please choose another one!");
     } else {
         errorAlert("Sorry, but username " + name + " is already taken.  Please choose another one!");
     }

     nicknameWell.showAsCurrent();
     connectIfHaveToken();
     return false;
 };

 chat.client.loggedOut = function () {
     localStorage.clear();
     swal("You have successfully logged out!", "See you later!", "success");
     nicknameWell.showAsCurrent();
     connectIfHaveToken();
     return false;
 }

 chat.client.joinedToChat = function (token, userlist) {

     if (token !== "") {
         localStorage.setItem("token", token);
     }
     $('#message-well').showAsCurrent();
     usernameUpdate(userlist);

 };

 chat.client.sasAquired = function (url, sas) {
     filesender.startSending(url, sas);
 };

 chat.client.addUser = function (name) {
     $('#logged-users').append("<li>" + name + "</li>");
 }

 chat.client.enters = function (name) {
     addToMessageBoard('<dt><i>' + name + ' joins the conversation</i></dt><dl></dl>');
 }

 chat.client.disconnected = function (name) {
     //Calls when someone leaves the page

     addToMessageBoard('<dt><i>' + name + ' leaves the conversation</i></dt><dl></dl>');
     $('#logged-users li').remove(":contains('" + name + "')");
 }

 chat.client.broadcastMessage = function (name, message) {
   var msg = anchorme(message,anchormeConfig);
   var html = "<dt>" + name + "</dt><dd>" + msg + "<dd>";
   addToMessageBoard(html);
 };

 chat.client.broadcastImage = function (fileInfo) {

     console.log(fileInfo);
     var image = new Image();
     image.src = fileInfo.url;
     image.id = "image" + ++imgid;
     image.className = "img-responsive img-thumbnail enlarge-img";
     $(image).attr("data-name", fileInfo.name);
     fileInfo.html = $(image).prop('outerHTML');
     var fileThumbnail = getFileThumbnailHtml(fileInfo);

     $(image).on('load', function () {
         addToMessageBoard(fileThumbnail);
     });

 };

 chat.client.broadcastVideo = function (fileInfo) {
     fileInfo.html = "<video controls><source src='" + fileInfo.url + "' type='" + fileInfo.type + "'</video>";
     var fileThumbnail = getFileThumbnailHtml(fileInfo);
     addToMessageBoard(fileThumbnail);
 };

 chat.client.broadcastAudio = function (fileInfo) {
     fileInfo.html = "<audio controls><source src='" + fileInfo.url + "' type='" + fileInfo.type + "'</audio>";
     var fileThumbnail = getFileThumbnailHtml(fileInfo);
     addToMessageBoard(fileThumbnail);

 };

 chat.client.broadcastFile = function (fileInfo) {
     fileInfo.html = "<img src='img/fileicon.png' width='150'/>";
     var fileThumbnail = getFileThumbnailHtml(fileInfo);
     addToMessageBoard(fileThumbnail);
 };

 chat.client.fileTooBig = function (fileSizeInBytes) {
     showFileInput();
     swal("File too big!", "Maximum filesize is " + parseInt(fileSizeInBytes) / mb + "MB", "error");
 }

 chat.client.lastMessages = function (messages) {
   $('#messages').html("");
    if (messages.length === 0) {
        return;
    }
    $("#oldest-message").val(messages[messages.length - 1].SentTime);
    var messageHtml = anchorme(getMessagesHtml(messages), anchormeConfig);
     $("#messages").prepend(messageHtml);
     setTimeout(function () {
         messageBoard.scrollTop(messageBoard[0].scrollHeight);
         previousMessageBatchRecieved = true;
     }, 100);

 }

 chat.client.olderMessages = function (messages) {
     if (messages.length === 0) {
         return;
     }
     $("#oldest-message").val(messages[messages.length - 1].SentTime);

     var lastmsg = $('dt:first');
     var messageHtml = anchorme(getMessagesHtml(messages), anchormeConfig);
     $("#messages").prepend(messageHtml);
     $(messageBoard).scrollTop(lastmsg.position().top);
     if (messages.length === messageBatchLength) {
         previousMessageBatchRecieved = true;
     }

 }

 function getMessagesHtml(messagesObjs) {
     var messagesHtml = "";
     var today = new Date();
     for (var i = messagesObjs.length - 1; i >= 0; i--) {
         var message = messagesObjs[i];
         var date = dateFromJSON(message.SentTime);
         var hours = date.getHours() + 2
         date.setHours(hours);
         var time = date.getStringTime();
         messagesHtml += "<dt class='pull-right date'>" + ((DatesAreTheSame(date, today)) ? time: date.getStringDate() + " " + time) + "</dt>";
         if (message.Size === 0) {
             messagesHtml += "<dt>" + message.UserName + "</dt><dd>" + message.Text + "<dd>";
         } else {
             message.url = message.Text;
             message.sender = message.UserName;
             message.name = message.Text.split("/").pop();
             message.size = message.Size;
             message.html = "<img src='img/fileicon.png' width='150'/>";
             messagesHtml += getFileThumbnailHtml(message);
         }

     };
     return messagesHtml;
 }


 // Start the connection.
 $.connection.hub.start().done(function () {
     //Calls the notify method of the server
     pageStart();

     function sendMessage() {
         chat.server.send($('#myMessage').val(), new Identity());
         autoScrollingEnabled = true;
         $('#myMessage').val('').focus();
     }

     $('#log_out').click(function (e) {
         stopDefault(e);
         chat.server.logOut()
     });

     $('#sendbutton').click(function () {
         sendMessage();
         $(this).hide();
     });

     $('#send-file').click(function () {
         var files = document.getElementById('myFile').files;

         if (files.length > 0 && !window.fileSender) {
             filesender = new FileSender(files[0]);
             filesender.broadcastFile();
         }
     });


     $('#myMessage').on('keyup', function (e) {

         if (e.which === 13) {
             stopDefault(e);
             if ($('#myMessage').val()) {
                 sendMessage();
             }

         }

         for (var i in map) {
             if (map.hasOwnProperty(i)) {
                 var regex = new RegExp(escapeSpecialChars(i), 'gim');
                 this.value = this.value = this.value.replace(regex, map[i]);
             }
         }

         if ($('#myMessage').val()) {

             $('#sendbutton').fadeIn(500);
         } else {
             $('#sendbutton').hide();
         }

     });
 });

 $.connection.hub.disconnected(function () {

     if ($.connection.hub.lastError) {

         //            alert("Disconnected. Reason: " +  $.connection.hub.lastError.message);
         swal({
             title: 'You have been disconnected',
             type: "error",

             showCancelButton: false,
             showLoaderOnConfirm: true,
             allowOutsideClick: false,
             confirmButtonColor: '#F27474',
             confirmButtonText: 'Reconnect me!',
             preConfirm: function() {
                 return new Promise(function(resolve) {
                     swal.insertQueueStep("Reconnecting...") ;
                     $.connection.hub.start().done(function() {
                         swal({
                             title: 'Connected!',
                             timer: 500,
                             type: "success"
                         });
                         pageStart();
                     });
                   });
             }
         });
     }
 });

 function errorAlert(msg) {
     swal(
         'Oops...',
         msg,
         'error'
     );
 }

 (function ($) {
     $.fn.scrolledToBottom = function () {
         return this[0].scrollHeight - this[0].scrollTop <= this.innerHeight() + 30;
     };
 }(jQuery));

 function Identity() {
     this.token = localStorage.getItem('token');
     this.name = localStorage.getItem('name');
     this.isValid = this.token && this.name;
 }

 function NewIdentity(name) {
     this.name = name;
     this.token = "";
     localStorage.setItem("name", name);
 }

 function FileInfo(file) {
     this.name = file.name;
     this.size = file.size;
     this.extension = file.name.split('.').pop();
     this.type = file.type;
 }

 function FileSender(file) {
     var that = this;
     this.file = file;
     this.reader = new FileReader();
     this.fileContent = file.slice(0, this.file.size - 1);
     this.url = null;
     this.sas = null;
     this.reader.onloadend = function (evt) {
         if (evt.target.readyState === FileReader.DONE) {
             var requestData = new Uint8Array(evt.target.result);
             that.sendToAzure(requestData);
         }
     }

     this.startSending = function (url, sastoken) {

         showProgressBar();
         this.url = url;
         this.sas = sastoken;
         this.reader.readAsArrayBuffer(this.fileContent);
     }

     this.broadcastFile = function () {
         autoScrollingEnabled = true;
         var name = localStorage.getItem('name');
         var token = localStorage.getItem('token');
         var finfo = new FileInfo(this.file);
         if (this.url != null) {
             finfo.url = this.url;
         }
         chat.server.sendFile(finfo, name, token);
     }

     this.sendToAzure = function (rawData) {

         var uploadBar = $('#upload-bar');

         $.ajax({
             xhr: function () {
                 var xhr = new window.XMLHttpRequest();

                 // Upload progress
                 xhr.upload.addEventListener("progress", function (evt) {
                     if (evt.lengthComputable) {
                         var percentComplete = (evt.loaded / evt.total) * 100;
                         uploadBar.css("width", percentComplete + '%');
                         uploadBar.text(Math.round(percentComplete) + '%');
                     }
                 }, false);

                 $('#cancel-button').click(function () {
                     if (xhr) {
                         xhr.abort();
                         showFileInput();
                         swal("Your upload has been canceled", "", "error");
                     }
                 });

                 return xhr;
             },
             url: this.url + this.sas,
             type: "PUT",
             data: rawData,
             processData: false,
             beforeSend: function (xhr) {
                 xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
                 xhr.setRequestHeader('x-ms-blob-content-type', that.file.type);
                 xhr.setRequestHeader('x-ms-meta-uploadvia', 'ChatApp');
             },
             success: function (data, status) {
                 that.broadcastFile();
                 showFileInput();
             },
             error: function (xhr, desc, err) {
                 console.log(desc);
                 console.log(err);
             }
         });
     }
 }

 function showProgressBar() {
     $('.file-input').hide();
     $("#file-upload").prepend(
         "<div class='text-center' id='progress-div'>" +
         "<div class='progress progress-striped active'>" +
         "<div class='progress-bar progress-bar-primary' id='upload-bar' role='progressbar'></div>" +
         "</div>" +
         "<button type='button' id='cancel-button' class='btn btn-danger'>Cancel upload</button>" +
         "</div>"
     );
 }

 function showFileInput() {
     $('#progress-div').remove();
     $('.file-input').fadeIn();
     $('#myFile').val('');
     filesender = null;
 }

 function getFileThumbnailHtml(file) {
     return "<dt>" + file.sender + " sends file!" +
         "</dt> <dd> <div class='file-thumbnail'>" +
         "<div class='thumbnail-header'>" +
         "<h5 class='file-name text-center'>" + file.name + "</h5></div>" +
         "<div class='thumbnail-body'>" +
         file.html +
         "</div><div class='thumbnail-footer'><a href='" + file.url + "' class='btn btn-default pull-left download-button' download>" +
         "<span class='glyphicon glyphicon-floppy-save'></span></a>" +
         "<div class='text-right pull-right file-info'><small>Sent by:" + file.sender + "</small><br/><small>Size:" +
         (file.size / mb).toFixed(2) +
         " MB</small>" +
         "</div></div></div></dd>";
 }

 function addToMessageBoard(html) {
     var dateStamp = "<dt class='pull-right date'>" + new Date().getStringTime() + "</dt>";
     $("#messages").append(dateStamp + html);

     if (autoScrollingEnabled) {
         messageBoard.scrollTop(messageBoard[0].scrollHeight);
         preventOnScroll = true;
     }
 }

 function stopDefault(e){
   e.preventDefault && e.preventDefault();
   e.stopPropagation && e.stopPropagation();
 }

Date.prototype.getStringTime = function() {
   var hours = this.getHours();
   var minutes = this.getMinutes();
   return (hours < 10 ? "0" + hours: hours) + ":" + (minutes < 10 ? "0" + minutes: minutes);
}

Date.prototype.getStringDate = function () {
   var day = this.getDate(), month = this.getMonth() + 1, year = this.getFullYear();
   return (day < 10 ? "0" + day: day) + "-" + (month < 10 ? "0" + month: month) + "-" + year;
}

function dateFromJSON(str) {
     var m = str.match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)/);
     return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
 }

 function DatesAreTheSame(date1, date2) {
     return date1.setHours(0, 0, 0, 0) === date2.setHours(0, 0, 0, 0);
 }

 function changeRoom() {
$('#modal-title').html("Choose room");
$('#header-content').html("");
$("#modal-body").html($(".list-rooms").last().clone(true));
$('#myModal').modal('show');

};


function addRoom() {
swal({
   title: 'Add new room!',
   html:
   '<br/>Room name<input name="room-name"  pattern="[a-zA-Z0-9-]+" id="swal-input1" class="swal2-input">' +
   'Room Password (Leave empty to make it public!)<input id="swal-input2" class="swal2-input">',
   preConfirm: function () {
       return new Promise(function (resolve, reject) {
           var name = $('#swal-input1').val();
           if (name === "") {
               reject("Name can't be empty!");
           }
           else if (!$('#swal-input1')[0].checkValidity()) {
               reject("Name has to be only letters and numbers!");
           };
           resolve([
               $('#swal-input1').val(),
               $('#swal-input2').val()
           ]);
       });
   },
   showCancelButton: true,
   onOpen: function () {
       $('#swal-input1').focus();
   }
}).then(function (result) {
   chat.server.addRoom(result[0], result[1], new Identity());
}).catch(swal.noop);
};

function inviteToRoom() {
swal({
title: 'Invite user to the room!',
html:
'<br/>User Name<input name="room-name" id="swal-input1" class="swal2-input">' +
'Room Password <input id="swal-input2" class="swal2-input">',
preConfirm: function () {
   return new Promise(function (resolve, reject) {
       var name = $('#swal-input1').val();
       if (name === "") {
           reject("Name can't be empty!");
       }
       resolve([
           $('#swal-input1').val(),
           $('#swal-input2').val()
       ]);
   });
},
showCancelButton: true,
onOpen: function () {
   $('#swal-input1').focus();
}
}).then(function (result) {
chat.server.inviteUser(result[0], result[1], new Identity());
}).catch(swal.noop);
};

$("#room-options").click(function (e) {
stopDefault(e);
swal({
   title: 'Room options',
   html:
       '<div class="list-group">' +
           '<a href="#" class="list-group-item" id="change-room">Change rooms</a>' +
           '<a href="#" class="list-group-item" id="add-room">Add new room</a>' +
           '<a href="#" class="list-group-item hidden" id="invite-new">Invite users</a>' +
           '</div>',
   showConfirmButton: false,
   showCancelButton:true,
   onOpen: function () {
       $('#add-room').click(function (e) {
           stopDefault(e);
           addRoom();
       });

       $('#change-room').click(function (e) {
           stopDefault(e);
           swal.close();
           changeRoom();
       });

       if ($('.list-rooms .active').hasClass("password-protected")) {
           $("#invite-new").removeClass("hidden");
       };

       $('#invite-new').click(function (e) {
           stopDefault(e);
           swal.close();
           inviteToRoom();
       });

   }
}).then(function(result) {
   swal(JSON.stringify(result));
}).catch(swal.noop);
});

chat.client.roomChanged = function (roomName, newRoomUsers) {
 $("#current-room").text("Room: " + roomName);
 usernameUpdate(newRoomUsers);
 $(".list-rooms a").removeClass("active");
 $(".room" + roomName).addClass("active");
}

chat.client.room404 = function(roomName) {
 swal("Room 404!", "Sorry, but room " + roomName + " no longer exists :(", "error");
}

chat.client.user404 = function(userName) {
 swal("User 404!", "Sorry, but user " + userName + " cannot be found :(", "error");
}

chat.client.closeAlert = function() {
 swal.close();
}

chat.client.invitationDeclined = function(name) {
 addToMessageBoard('<dt><i>User ' + name + ' declined invitation</i></dt><dl></dl>');
}

chat.client.roomInvitation = function(userName, roomName, roomPassword) {
 swal({
     title: 'You have an invitation!',
     text: userName + " invites you to " + roomName + " room. Do you accept?",
     type: 'success',
     showCancelButton: true,
     confirmButtonColor: '#3085d6',
     cancelButtonColor: '#d33',
     confirmButtonText: "Accept",
     cancelButtonText: 'Decline',
     allowOutsideClick: false,
     allowEscapeKey: false,
     allowEnterKey: false
 }).then(function() {
         chat.server.changeRoom(roomName, roomPassword, new Identity());
     },
     function(dismiss) {
         // dismiss can be 'cancel', 'overlay',
         // 'close', and 'timer'
         if (dismiss === 'cancel') {
             chat.server.declineInvitation(roomName, new Identity());
         }
     });
}

chat.client.roomRemoved = function(roomName) {
 $('.list-rooms a').remove(":contains('" + roomName + "')");
}

chat.client.newRoom = function(room) {
 $('.list-rooms').append(createRoomNode(room));
}

chat.client.invalidRoomPassword = function(roomName) {
 swal("Invalid room password!", "You entered invalid password for room " + roomName , "error");
}


$(".list-rooms").on("click", "a", function (e) {
 stopDefault(e);
 if ($(this).hasClass("password-protected")) {
     var that = this;
     swal({
         title: 'This room is password-protected',
         text: 'Please enter password',
         type: 'warning',
         input: 'text',
         showCancelButton: true,
         inputValidator: function(value) {
             return new Promise(function(resolve, reject) {
                 if (value) {
                     resolve();
                 } else {
                     reject('You need to write something!');
                 }
             });
         }
     }).then(function(result) {
         chat.server.changeRoom($(that).text(), result, new Identity());
         $('#myModal').modal('hide');
     });

 } else {
     chat.server.changeRoom($(this).text(), "", new Identity());
     $('#myModal').modal('hide');
 }

});

chat.client.roomList = function (rooms, currentRoom) {
$("#current-room").text("Room: "+currentRoom.Name);
var html = "";
html += createRoomNode(currentRoom, "active");
for (var i = 0; i < rooms.length; i++) {
 html  += createRoomNode(rooms[i]);
}
$(".list-rooms").html(html);
}

function createRoomNode(room, additionalClass="") {
if (room.HasPassword) {
   room.Name += " <span class='glyphicon glyphicon-lock'<span>";
   additionalClass += " password-protected";
}
return '<a href="#" class="list-group-item ' + additionalClass + ' room' + room.Name + '">' + room.Name + '</a>';
}

