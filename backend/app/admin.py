"""Administrative recovery; prompts for the password, never accepts it in argv."""

import argparse
import getpass

import psycopg

from .auth import passwords
from .config import Settings
from .models import Credentials


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args()
    password = getpass.getpass("New password: ")
    if password != getpass.getpass("Repeat password: "):
        parser.error("Passwords differ")
    account = Credentials(name=args.username, password=password)
    with psycopg.connect(Settings().database_url) as conn:
        if args.reset_password:
            row = conn.execute(
                "UPDATE users SET hash = %s WHERE lower(name) = lower(%s) AND role = 'admin' RETURNING id",
                (passwords.hash(account.password), account.name),
            ).fetchone()
            if not row:
                parser.error("Administrator not found")
        else:
            conn.execute(
                "INSERT INTO users(name, role, hash) VALUES (%s, 'admin', %s)",
                (account.name, passwords.hash(account.password)),
            )
    print("Administrator account updated.")


if __name__ == "__main__":
    main()
