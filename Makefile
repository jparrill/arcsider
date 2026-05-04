.PHONY: test zip clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

test: ## Run tests (zero dependencies, uses node:test)
	node --test test/*.test.js

zip: ## Package extension into arcsider.zip
	@rm -f arcsider.zip
	zip -r arcsider.zip manifest.json background.js sidepanel.html sidepanel.js sidepanel.css lib.js icons/

clean: ## Remove build artifacts
	rm -f arcsider.zip
