# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { addIdea, removeIdea, reportIdea, listApprovedIdeas } from '@dataconnect/generated';


// Operation AddIdea:  For variables, look at type AddIdeaVars in ../index.d.ts
const { data } = await AddIdea(dataConnect, addIdeaVars);

// Operation RemoveIdea:  For variables, look at type RemoveIdeaVars in ../index.d.ts
const { data } = await RemoveIdea(dataConnect, removeIdeaVars);

// Operation ReportIdea:  For variables, look at type ReportIdeaVars in ../index.d.ts
const { data } = await ReportIdea(dataConnect, reportIdeaVars);

// Operation ListApprovedIdeas:  For variables, look at type ListApprovedIdeasVars in ../index.d.ts
const { data } = await ListApprovedIdeas(dataConnect, listApprovedIdeasVars);


```