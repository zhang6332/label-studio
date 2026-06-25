# Generated for RBAC feature: adds role column to ProjectMember.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0034_project_annotator_evaluation_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectmember',
            name='role',
            field=models.CharField(
                choices=[
                    ('manager', 'Manager'),
                    ('reviewer', 'Reviewer'),
                    ('annotator', 'Annotator'),
                ],
                default='annotator',
                help_text='RBAC role scoped to this project membership.',
                max_length=32,
                verbose_name='role',
            ),
        ),
    ]
