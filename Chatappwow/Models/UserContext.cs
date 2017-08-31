using System.Data.Entity;

namespace Chatappwow.Models
{
    public class UserContext: DbContext
    {
        public DbSet<User> Users { get; set; }
        public DbSet<Connection> Connections { get; set; }
        public DbSet<Room> Rooms { get; set; }
        public DbSet<Message> Messages { get; set; }


        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Room>().HasMany(r => r.Messages).WithRequired(m => m.Room).WillCascadeOnDelete(true);
        }
    }
}