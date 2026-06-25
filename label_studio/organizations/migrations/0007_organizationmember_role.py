# Generated for RBAC feature: adds role column to OrganizationMember.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0006_alter_organizationmember_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationmember',
            name='role',
            field=models.CharField(
                choices=[
                    ('owner', 'Owner'),
                    ('manager', 'Manager'),
                    ('reviewer', 'Reviewer'),
                    ('annotator', 'Annotator'),
                ],
                default='annotator',
                help_text='RBAC role scoped to this organization.',
                max_length=32,
                verbose_name='role',
            ),
        ),
    ]
