<?php

namespace InertiaUI\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The request that removes a push subscription of the signed-in user, by the endpoint of its browser.
 */
class UnsubscribePushRequest extends FormRequest
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
            'endpoint' => ['required', 'string', 'max:'.SubscribePushRequest::MAX_ENDPOINT_LENGTH],
        ];
    }

    /**
     * Get the endpoint of the subscription to remove.
     */
    public function endpoint(): string
    {
        return (string) $this->validated('endpoint');
    }
}
