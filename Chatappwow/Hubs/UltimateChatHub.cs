using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Data.Entity;
using System.Data.Entity.Migrations;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Runtime.Remoting.Contexts;
using System.Runtime.Serialization;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc.Routing.Constraints;
using System.Web.UI;
using Chatappwow.Models;
using Chatappwow.Utils;
using Microsoft.AspNet.SignalR;

namespace Chatappwow.Hubs
{
    public class ChatHub : Hub
    {
        private const string DefaultRoom = "General";
        
        public void Send(string message, Identity identity)
        {
            using (var db = new UserContext())
            {
                User usr;
                if (identity.TryGetUser(db, IncludeFields.Room, out usr))
                {
                    message = HttpUtility.HtmlEncode(message);
                    db.Messages.Add(new Message(usr, message));
                    db.SaveChanges();
                    Clients.Group(usr.Room.Name).broadcastMessage(usr.UserName, message);
                }
            }
        }


        public void GetOlderMessages(string date, Identity identity)
        {
            using (var db = new UserContext())
            {
                DateTime myDate;
                User usr;
                if (DateTime.TryParse(date, out myDate) && identity.TryGetUser(db, IncludeFields.Room, out usr))
                {
                    var olderMessages = db.Messages.Where(m => m.Room.Name == usr.Room.Name && m.SentTime < myDate).OrderByDescending(m => m.SentTime).
                        Take(15).ToList();
                    if (olderMessages.Count == 1 && olderMessages[0].SentTime == myDate) olderMessages = new List<Message>();
                    Clients.Caller.olderMessages(olderMessages);
                }
            }

        }

        public void InviteUser(string invitedName, string password, Identity identity)
        {
            using (var db = new UserContext())
            {
                User usr;
                if (!identity.TryGetUser(db, IncludeFields.Room, out usr)) return;

                if (usr.Room.Password != password)
                {
                    Clients.Caller.InvalidRoomPassword(usr.Room.Name);
                    return;
                }
                var invitedUser = db.Users.Find(invitedName);
                if (invitedUser == null)
                {
                    Clients.Caller.User404(invitedName);
                    return;
                }
                Clients.Group(invitedUser.Token).roomInvitation(usr.UserName, usr.Room.Name, usr.Room.Password);
            }
        }

        public void DeclineInvitation(string roomName, Identity identity)
        {
            using (var db = new UserContext())
            {
                User usr;
                if (!identity.TryGetUser(db, IncludeFields.Room, out usr)) return;
                Clients.OthersInGroup(usr.Token).CloseAlert();
                Clients.Group(roomName).InvitationDeclined(usr.UserName);
            }
        }

        public async Task ChangeRoom(string roomName, string password, Identity identity)
        {
            User usr;
            Room newRoom;
            Room oldRoom;
            List<Message> lastMessages;
            using (var db = new UserContext())
            {
                if (identity.TryGetUser(db, IncludeFields.All, out usr) && Room.TryGetRoom(db, roomName, out newRoom))
                {
                    if (newRoom.HasPassword && newRoom.Password != password)
                    {
                        Clients.Caller.InvalidRoomPassword(roomName);
                        return;
                    }

                    oldRoom = usr.Room;
                    usr.Room = newRoom;
                    
                    if (!oldRoom.IsBuiltIn && oldRoom.Users.Count == 1)
                    {
                        Clients.All.RoomRemoved(oldRoom.Name);
                        db.Rooms.Remove(oldRoom);
                    }
                    lastMessages = db.Messages.Where(m => m.Room.Name == usr.Room.Name).OrderByDescending(m => m.SentTime).
                        Take(15).ToList();
                    db.SaveChanges();
                }
                else 
                {
                    if (usr != null) Clients.Caller.Room404(roomName);
                    return;
                }
            }
            Clients.OthersInGroup(newRoom.Name).addUser(usr.UserName);
            foreach (var con in usr.Connections)
            {
                Groups.Remove(con.ConnectionId, oldRoom.Name);
                Groups.Add(con.ConnectionId, newRoom.Name);
            }
            await Groups.Remove(Context.ConnectionId, oldRoom.Name);
            await Groups.Add(Context.ConnectionId, newRoom.Name);
            Clients.Group(usr.Token).lastMessages(lastMessages);
            Clients.Group(oldRoom.Name).disconnected(usr.UserName);
            var userNames = usr.Room.Users.Select(r => r.UserName).ToList();
            Clients.Group(usr.Token).RoomChanged(newRoom.Name, userNames);
            Clients.Group(newRoom.Name).enters(usr.UserName);
        }

        public async Task AddRoom(string roomName, string password, Identity identity)
        {
            using (var db = new UserContext())
            {
                if (!db.Users.Any(u => u.UserName == identity.Name && u.Token == identity.Token) || db.Rooms.Any(r => r.Name == roomName))
                {
                    Clients.Caller.RoomExists();
                    return;
                }
                password = password == "" ? null : password;
                var room = new Room { Password = password, Name = roomName, IsBuiltIn = false };
                db.Rooms.Add(room);
                db.SaveChanges();
                Clients.All.NewRoom(room);
            }
            await ChangeRoom(roomName, password, identity);
            Clients.Caller.RoomAdded();
        }

        public async Task Notify(Identity identity)
        {
            if (!identity.IsValid())
            {
                Clients.Caller.differentName();
                return;
            }
            User user;
            bool newUserWasAdded;
           
            using (var db = new UserContext())
            {
                newUserWasAdded = TryAddUser(db, identity.Name, out user);
                if (!newUserWasAdded)
                {
                    if (user.Token != identity.Token)
                    {
                        Clients.Caller.differentName();
                        return;
                    }
                    user.Connections.Add(new Connection{ConnectionId = Context.ConnectionId});
                    db.SaveChanges();
                }
                var lastmessages = db.Messages.Where(m => m.Room.Name == user.Room.Name).OrderByDescending(m => m.SentTime).
                    Take(15).ToList();
                Clients.Caller.lastMessages(lastmessages);
                var rooms = db.Rooms.Where(r => r.Name != user.Room.Name);
                Clients.Caller.RoomList(rooms, new {Name = user.Room.Name, HasPassword = user.Room.HasPassword});
            }

            var userNames = user.Room.Users.Select(r => r.UserName).ToList();
            await Groups.Add(Context.ConnectionId, user.Room.Name);
            if (newUserWasAdded)
            {
                Clients.OthersInGroup(DefaultRoom).addUser(user.UserName);
                Clients.Group(DefaultRoom).enters(user.UserName);
            }
            Clients.Caller.joinedToChat(user.Token, userNames);
            Groups.Add(Context.ConnectionId, user.Token);
        }

        private bool TryAddUser(UserContext db, string name, out User user)
        {
            user = db.Users.Include(u => u.Connections).Include(u => u.Room.Users).
                SingleOrDefault(u => u.UserName == name);
            if (user != null) return false;
            var room = db.Rooms.Include(r => r.Users)
                .FirstOrDefault(r => r.Name == DefaultRoom);
            
            user = new User(name, new Connection { ConnectionId = Context.ConnectionId }, room);
            db.Users.Add(user);
            db.SaveChanges();
            return true;
        }

        private void Disconnect(bool allConnections = false)
        {
             using (var db = new UserContext())
            {
                var conn = db.Connections.Include(u => u.User.Connections).Include(u => u.User.Room.Users)
                    .SingleOrDefault(u => u.ConnectionId == Context.ConnectionId);
                if (conn == null) return;
                var usr = conn.User;
                if (allConnections || usr.Connections.Count == 1)
                {
                    var room = usr.Room;
                    Clients.Group(usr.Token).LoggedOut();
                    if (!room.IsBuiltIn && room.Users.Count == 1)
                    {
                        Clients.All.RoomRemoved(usr.Room.Name);
                        db.Rooms.Remove(usr.Room);
                    }
                    else
                    {
                        if (allConnections)
                        {
                            foreach (var con in usr.Connections)
                            {
                                Groups.Remove(con.ConnectionId, usr.Token);
                                Groups.Remove(con.ConnectionId, room.Name);
                            }
                        }
                        db.Users.Remove(usr);
                        Clients.Group(room.Name).disconnected(usr.UserName);
                    }
                }
                else
                {
                    db.Connections.Remove(conn);
                }
                db.SaveChanges();
            }
            
        }

        public override Task OnDisconnected(bool stopCalled)
        {
            Disconnect();
            return base.OnDisconnected(stopCalled);
        }

        public void LogOut()
        {
            Disconnect(true);
        }

        public void SendFile(File file, string name, string token)
        {   
            if (token == null || name == null ) return;
            User usr;
            using (var db = new UserContext())
            {
                usr = db.Users.Include(u => u.Room).SingleOrDefault(u => u.UserName == name && u.Token == token);
            }
            if (usr == null) return;
            file.AddUserInfo(usr, Context.ConnectionId);
            FileSendingService.Instance.UploadFile(file);
        }
       
    }

   
}