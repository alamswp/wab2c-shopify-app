import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  Badge,
  Banner,
  Checkbox,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getAllTemplates, updateTemplate } from "~/services/templates.server";

const PLACEHOLDERS = [
  "{{order_number}}", "{{order_name}}", "{{customer_name}}", "{{customer_first_name}}",
  "{{customer_phone}}", "{{customer_email}}", "{{total}}", "{{currency}}",
  "{{financial_status}}", "{{fulfillment_status}}", "{{shipping_address}}",
  "{{shipping_city}}", "{{shipping_country}}", "{{tracking_number}}", "{{tracking_url}}",
  "{{tracking_info}}", "{{refund_amount}}", "{{payment_method}}", "{{recovery_url}}",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const templates = await getAllTemplates(session.shop);
  return json({ templates });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const eventType = String(formData.get("eventType"));
  const body = String(formData.get("body") || "");
  const name = String(formData.get("name") || "");
  const isActive = formData.get("isActive") === "true";

  await updateTemplate(session.shop, eventType as any, { name, body, isActive });
  return json({ success: true, eventType });
};

export default function TemplatesPage() {
  const { templates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  return (
    <Page title="Message Templates" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {(actionData as any)?.success && (
          <Banner title="Template saved!" tone="success" />
        )}

        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Available Placeholders</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {PLACEHOLDERS.join(", ")}
            </Text>
          </BlockStack>
        </Card>

        {templates.map((tpl: any) => (
          <TemplateCard key={tpl.id} template={tpl} submit={submit} />
        ))}
      </BlockStack>
    </Page>
  );
}

function TemplateCard({ template, submit }: { template: any; submit: any }) {
  const [body, setBody] = useState(template.body);
  const [name, setName] = useState(template.name);
  const [isActive, setIsActive] = useState(template.isActive);

  return (
    <Card>
      <BlockStack gap="400">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text as="h2" variant="headingMd">{template.eventType.replace(/_/g, " ")}</Text>
          <Badge tone={isActive ? "success" : "new"}>{isActive ? "Active" : "Disabled"}</Badge>
        </div>
        <Divider />
        <TextField
          label="Template Name"
          value={name}
          onChange={setName}
          autoComplete="off"
        />
        <TextField
          label="Message Body"
          value={body}
          onChange={setBody}
          multiline={4}
          autoComplete="off"
          helpText="Use placeholders like {{order_number}}, {{customer_name}}"
        />
        <Checkbox
          label="Enabled"
          checked={isActive}
          onChange={setIsActive}
        />
        <Button
          variant="primary"
          onClick={() => {
            const fd = new FormData();
            fd.set("eventType", template.eventType);
            fd.set("name", name);
            fd.set("body", body);
            fd.set("isActive", String(isActive));
            submit(fd, { method: "post" });
          }}
        >
          Save Template
        </Button>
      </BlockStack>
    </Card>
  );
}
