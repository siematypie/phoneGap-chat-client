using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using Newtonsoft.Json;
using System.Data.Entity;


namespace Chatappwow.Models
{
    public class Room
    {
        [Key]
        public string Name { get; set; }
        public bool IsBuiltIn { get; set; }
        [NotMapped]
        public bool HasPassword { get; set; }

        private string _password;

        [JsonIgnore]
        public string Password
        {
            get { return _password; }
            set
            {
                HasPassword = value != null;
                _password = value;
            }
        }

        public ICollection<User> Users { get; set; }
        public ICollection<Message> Messages { get; set; }

        public static bool TryGetRoom(UserContext db, string roomName, out Room room)
        {
            room = db.Rooms.Include(r => r.Users).FirstOrDefault(r => r.Name == roomName);
            return room != null;
        }
    }
}