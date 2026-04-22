# Contributing to OpenLDR

Thank you for your interest in contributing to OpenLDR! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. By participating, you are expected to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**

- OS: [e.g., Ubuntu 22.04]
- Docker version: [e.g., 20.10.21]
- Node.js version: [e.g., 18.16.0]
- Browser (if applicable): [e.g., Chrome 120]

**Additional context**
Any other context about the problem.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description** of the enhancement
- **Use case**: Explain why this would be useful
- **Proposed solution**: If you have ideas on implementation
- **Alternatives considered**: Other approaches you've thought about

### Contributing Code

We love pull requests! Here's how to contribute code:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

### Contributing Documentation

Documentation improvements are always welcome:

- Fix typos or clarify existing documentation
- Add examples or tutorials
- Translate documentation
- Create video tutorials or guides

### First Time Contributors

Look for issues labeled `good first issue` - these are specifically chosen to be approachable for newcomers. Don't hesitate to ask questions!

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (version 24+)
- [Docker](https://www.docker.com/) and Docker Compose
- A code editor (we recommend [VS Code](https://code.visualstudio.com/))

### Setting Up Your Development Environment

1. **Fork the repository**

   Click the "Fork" button at the top right of the repository page.

2. **Clone your fork**

```bash
   git clone https://github.com/YOUR-USERNAME/openldr.git
   cd openldr
```

3. **Add upstream remote**

```bash
   git remote add upstream https://github.com/APHL-Global-Health/openldr.git
```

4. **Install dependencies**

```bash
   npm install
```

5. **Initialize environment**

```bash
   npm run init
```

Select `127.0.0.1` when prompted for IP address.

6. **Build and start services**

```bash
   npm run docker:build
   npm run docker:start
```

7. **Verify installation**

   Visit `http://127.0.0.1:3000/web/` in your browser.

## Development Workflow

### Branch Naming Convention

Use descriptive branch names following this pattern:

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Adding or updating tests

Examples:

- `feature/add-csv-export`
- `bugfix/fix-login-redirect`
- `docs/update-installation-guide`

### Making Changes

1. **Create a new branch**

```bash
   git checkout -b feature/your-feature-name
```

2. **Keep your branch updated**

```bash
   git fetch upstream
   git rebase upstream/main
```

3. **Make your changes**
   - Write clean, readable code
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation as needed

4. **Test your changes**

```bash
   # Run tests for a specific service
   cd apps/openldr-entity-services
   npm test

   # Build to check for compilation errors
   npm run docker:build
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use meaningful variable and function names
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises when possible
- Add JSDoc comments for public functions

**Example:**

```typescript
/**
 * Retrieves facility data by ID
 * @param facilityId - The unique identifier of the facility
 * @returns Promise resolving to facility data
 * @throws {NotFoundError} If facility doesn't exist
 */
async function getFacilityById(facilityId: string): Promise<Facility> {
  const facility = await Facility.findByPk(facilityId);

  if (!facility) {
    throw new NotFoundError(`Facility ${facilityId} not found`);
  }

  return facility;
}
```

### React/Frontend

- Use functional components with hooks
- Follow React best practices
- Keep components small and focused
- Use TypeScript interfaces for props
- Handle loading and error states

**Example:**

```typescript
interface FacilityListProps {
  onSelect: (facilityId: string) => void;
}

export const FacilityList: React.FC<FacilityListProps> = ({ onSelect }) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Component logic here
};
```

### File Naming

- Use kebab-case for files: `facility-service.ts`
- Use PascalCase for React components: `FacilityList.tsx`
- Use camelCase for variables and functions: `getFacilities()`
- Use UPPER_SNAKE_CASE for constants: `MAX_RETRY_COUNT`

### Code Formatting

We use Prettier for code formatting:

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Examples

```bash
feat(entity-services): add facility search endpoint

Implements new GET /api/v1/facilities/search endpoint
that supports filtering by name, code, and region.

Closes #123
```

```bash
fix(web): resolve login redirect loop

Users were stuck in redirect loop when session expired.
Fixed by clearing stale tokens before redirect.

Fixes #456
```

```bash
docs(installation): update Docker memory requirements

Increased minimum RAM recommendation from 8GB to 16GB
based on production usage feedback.
```

### Tips for Good Commits

- Keep commits atomic (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issue numbers when applicable
- Separate subject from body with a blank line
- Use the imperative mood ("add feature" not "added feature")

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally
- [ ] Documentation has been updated
- [ ] Commits follow the commit guidelines
- [ ] Branch is up to date with main

### Submitting a Pull Request

1. **Push your changes**

```bash
   git push origin feature/your-feature-name
```

2. **Create the PR**

   Go to the repository on GitHub and click "New Pull Request"

3. **Fill out the PR template**

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Related Issues

Closes #123

## Testing

Describe how you tested these changes

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] Tests pass locally
```

4. **Respond to feedback**
   - Be open to suggestions
   - Make requested changes promptly
   - Push updates to the same branch

### Review Process

- At least one maintainer review is required
- Automated tests must pass
- Documentation must be complete
- Code must meet quality standards

### After Your PR is Merged

1. **Delete your branch**

```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
```

2. **Update your fork**

```bash
   git checkout main
   git pull upstream main
   git push origin main
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd apps/openldr-entity-services
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Write tests for all new features
- Update tests when modifying existing code
- Aim for meaningful test coverage
- Use descriptive test names

**Example:**

```typescript
describe("FacilityService", () => {
  describe("getFacilityById", () => {
    it("should return facility when ID exists", async () => {
      const facility = await getFacilityById("LAB001");
      expect(facility.code).toBe("LAB001");
    });

    it("should throw NotFoundError when ID does not exist", async () => {
      await expect(getFacilityById("INVALID")).rejects.toThrow(NotFoundError);
    });
  });
});
```

## Documentation

### Documentation Standards

- Update relevant documentation with code changes
- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Keep README files up to date

### Documentation Locations

- **Architecture**: `/docs/architecture.md`
- **Installation**: `/docs/installation.md`
- **User Guides**: `/docs/` directory
- **Code Comments**: Inline in source files

### Building Documentation Locally

```bash
# Start documentation server (if available)
npm run docs:dev

# Build documentation
npm run docs:build
```

## Community

### Getting Help

- **GitHub Discussions**: For questions and general discussions
- **GitHub Issues**: For bug reports and feature requests

### Stay Updated

- Watch the repository for updates
- Follow project announcements
- Join community calls (if applicable)

## Recognition

Contributors are recognized in:

- Project README
- Release notes
- Contributors page

Thank you for contributing to OpenLDR and helping improve laboratory data management for everyone!

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
