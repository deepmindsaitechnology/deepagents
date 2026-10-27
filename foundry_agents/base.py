class BaseAgent:
    def prepare(self, context):
        """Developer extension point for trusted local code; never execute uploaded files."""
        return context
