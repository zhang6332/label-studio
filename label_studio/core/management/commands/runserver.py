"""Override Django's ``runserver`` so ``manage.py runserver`` (the PyCharm
debug path) behaves like ``server.py start`` (the production path):

  1. auto-applies pending database migrations
  2. bootstraps the default Owner account (``LABEL_STUDIO_USERNAME`` /
     ``LABEL_STUDIO_PASSWORD``, defaulting to ``zjh@zjh.com`` / ``zjh``)

Production deployments go through ``server.py main()`` and never invoke the
``runserver`` command, so they are unaffected by this override.
"""
import os

from django.core.management.commands.runserver import Command as BaseCommand


class Command(BaseCommand):
    help = 'Run the dev server, auto-applying migrations and bootstrapping the default Owner.'

    def handle(self, **options):
        # _auto_setup runs in the reloader parent process (one shot); the child
        # process goes straight to inner_run via autoreload, so this is not
        # re-executed on every code reload.
        self._auto_setup()
        super().handle(**options)

    def _auto_setup(self):
        # Default Owner credentials (LABEL_STUDIO_USERNAME/PASSWORD) are applied
        # via setdefault in core/settings/base.py at settings-load time, so they
        # are already in os.environ here. We just consume them below.

        # 1) Apply pending migrations (idempotent: skipped when DB is in sync).
        try:
            from django.db import DEFAULT_DB_ALIAS, connections
            from django.db.migrations.executor import MigrationExecutor

            connection = connections[DEFAULT_DB_ALIAS]
            connection.prepare_database()
            executor = MigrationExecutor(connection)
            pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
            if pending:
                from django.core.management import call_command

                self.stdout.write('runserver: applying pending migrations...')
                call_command('migrate', verbosity=0, interactive=False)
        except Exception as exc:  # noqa: BLE001 - never block dev server startup
            self.stderr.write(f'runserver: auto-migrate skipped: {exc}')

        # 2) Bootstrap default Owner (idempotent).
        try:
            from users.models import User
            from organizations.models import Organization

            username = os.environ.get('LABEL_STUDIO_USERNAME')
            password = os.environ.get('LABEL_STUDIO_PASSWORD')
            if not username:
                return

            user, _ = User.objects.get_or_create(email=username)
            if password:
                user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()

            org = Organization.objects.first()
            if org is None:
                org = Organization.create_organization(created_by=user, title='Label Studio')
            elif not org.has_user(user):
                org.add_user(user)

            user.active_organization = org
            user.save(update_fields=['active_organization'])
            self.stdout.write(f'runserver: default owner ready: {username} (org {org.id})')
        except Exception as exc:  # noqa: BLE001 - never block dev server startup
            self.stderr.write(f'runserver: default-owner bootstrap skipped: {exc}')
