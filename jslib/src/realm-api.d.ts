
declare namespace Realm.Permissions {
    class Permission {
        static schema: ObjectSchema;

        role: Role;
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canQuery: boolean;
        canModifySchema: boolean;
        canSetPermissions: boolean;
    }

    class User {
        static schema: ObjectSchema;
        id: string;
    }

    class Role {
        static schema: ObjectSchema;
        name: string;
        members: User[];
    }

    class Class {
        static schema: ObjectSchema;
        class_name: string;
        name: string;
        permissions: Permission[];
        findOrCreate(roleName: string): Permission;
    }

    class Realm {
        static schema: ObjectSchema;
        id: number;
        permissions: Permission[];
        findOrCreate(roleName: string): Permission;
    }

    class RealmPrivileges {
        canRead: boolean;
        canUpdate: boolean;
        canModifySchema: boolean;
        canSetPermissions: boolean;
    }

    class ClassPrivileges {
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canQuery: boolean;
        canModifySchema: boolean;
        canSetPermissions: boolean;
    }

    class ObjectPrivileges {
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canSetPermissions: boolean;
    }
}