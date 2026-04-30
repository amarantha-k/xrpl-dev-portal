import * as React from 'react';
import { DocumentationLayout as BaseDocumentationLayout } from '@redocly/theme/layouts/DocumentationLayout';
import { Attribution } from '@theme/components/attribution/Attribution';

/**
 * Custom DocumentationLayout that extends the default Redocly layout with a
 * contributor Attribution section placed between the page content and the
 * feedback / next-prev navigation widgets.
 *
 * All props are forwarded unchanged to the base layout; we only augment the
 * children by appending the Attribution component when an `editPage` URL is
 * available (i.e. for editable Markdown pages).
 */
export function DocumentationLayout(props: React.ComponentProps<typeof BaseDocumentationLayout>): JSX.Element {
  const { editPage, children, ...rest } = props;

  return (
    <BaseDocumentationLayout editPage={editPage} {...rest}>
      {children}
      {editPage?.to && <Attribution editPageUrl={editPage.to} />}
    </BaseDocumentationLayout>
  );
}
