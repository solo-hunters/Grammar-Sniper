# Grammar Sniper Browser Extension

A powerful browser extension that provides real-time grammar checking and suggestions for text inputs across the web. Grammar Sniper helps users write better by identifying grammar, spelling, and style issues as they type.

## Features

- Real-time grammar and spell checking
- Support for multiple text input types
- Custom UI for displaying suggestions
- Exclusion of specific sites (e.g., Google Docs)
- Easy-to-use popup interface
- Lightweight and performant

## Project Structure

```
├── manifest.json           # Extension configuration and permissions
├── content.js             # Main content script
├── popup.html             # Extension popup interface
├── popup.js              # Popup functionality
├── styles.css            # Global styles
├── modules/              # Core functionality modules
│   ├── utils.js         # Utility functions
│   ├── config.js        # Configuration settings
│   ├── api.js           # API integration
│   ├── dom.js           # DOM manipulation
│   ├── ui.js            # UI components
│   └── grammarCheck.js  # Grammar checking logic
└── images/              # Extension icons and assets
```

## Development Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd grammar-sniper
```

2. Install dependencies (if any are added in the future)

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension directory

## Development Guidelines

### Architecture

The extension follows a modular architecture with clear separation of concerns:
- `content.js`: Main entry point for the content script
- `modules/`: Contains isolated functionality in separate modules
- `popup.*`: Handles the extension's popup interface
- Styles are maintained in `styles.css`

### Adding New Features

1. Create new modules in the `modules/` directory if needed
2. Update `manifest.json` to include any new files or permissions
3. Follow the existing code style and patterns
4. Test thoroughly across different websites

### Code Style

- Use modern JavaScript (ES6+) features
- Maintain clear and consistent naming conventions
- Comment complex logic and document public APIs
- Follow single responsibility principle for modules

### Testing

1. Manual Testing:
   - Test on various websites
   - Verify functionality in different contexts
   - Check performance impact
   - Validate error handling

2. Cross-browser Testing (if implementing):
   - Test in Chrome
   - Test in other Chromium-based browsers

### Building for Production

1. Ensure all files are properly minified
2. Remove any console.log statements
3. Update version number in `manifest.json`
4. Test the production build thoroughly

## API Integration

The extension uses various modules for grammar checking functionality:
- `api.js`: Handles external API communications
- `grammarCheck.js`: Processes text and manages suggestions
- Ensure proper API key management and error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request with a clear description of changes

## Troubleshooting

Common issues and solutions:
- Extension not loading: Check manifest.json for errors
- Content script not running: Verify permissions and content_scripts configuration
- Styling issues: Check for CSS conflicts with target websites

## Security Considerations

- Never store sensitive data in localStorage without encryption
- Use content security policies appropriately
- Handle user data responsibly
- Keep API keys secure
