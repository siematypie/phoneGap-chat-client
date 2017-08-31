using Chatappwow.Models;

namespace Chatappwow.Migrations
{
    using System;
    using System.Data.Entity;
    using System.Data.Entity.Migrations;
    using System.Linq;

    internal sealed class Configuration : DbMigrationsConfiguration<Chatappwow.Models.UserContext>
    {
        public Configuration()
        {
            AutomaticMigrationDataLossAllowed = true;
            AutomaticMigrationsEnabled = true;
            ContextKey = "Chatappwow.Models.UserContext";
        }

        protected override void Seed(Chatappwow.Models.UserContext context)
        {
            //  This method will be called after migrating to the latest version.

            //  You can use the DbSet<T>.AddOrUpdate() helper extension method 
            //  to avoid creating duplicate seed data.
            context.Rooms.AddOrUpdate(new Room{Name="General", IsBuiltIn = true});
            context.Rooms.AddOrUpdate(new Room{Name="Funny", IsBuiltIn = true});
            context.Rooms.AddOrUpdate(new Room{Name="Politics", IsBuiltIn = true});
            context.Rooms.AddOrUpdate(new Room{Name="Sport", IsBuiltIn = true});
            context.Rooms.AddOrUpdate(new Room{Name="Photography", IsBuiltIn = true});
            context.Rooms.AddOrUpdate(new Room {Name = "SecretRoom", IsBuiltIn = true, Password = "abc"});

        }
    }
}
