<?php

namespace InertiaUI\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use InertiaUI\Notifications\Inbox;

/**
 * The request for one page of the signed-in user's notifications.
 */
class ListNotificationsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'filter' => ['nullable', Rule::in(Inbox::filters())],
            'category' => ['nullable', 'string'],
            'cursor' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * Get the built-in filter, or the key of the application's tab, that the page shows.
     */
    public function filter(): ?string
    {
        return $this->validated('filter');
    }

    /**
     * Get the category that the page is limited to.
     */
    public function category(): ?string
    {
        return $this->validated('category');
    }

    /**
     * Get the cursor of the page.
     */
    public function cursor(): ?string
    {
        return $this->validated('cursor');
    }

    /**
     * Get the number of notifications on the page, or null for the configured number.
     */
    public function perPage(): ?int
    {
        $perPage = $this->validated('per_page');

        if ($perPage === null) {
            return null;
        }

        return (int) $perPage;
    }
}
