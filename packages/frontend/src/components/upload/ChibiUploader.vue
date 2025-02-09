<template>
	<div class="w-80 h-80 max-h-[320px] max-w-[320px] absolute right-0 top-0">
		<div
			id="upload"
			class="absolute w-full h-full right-0 top-0 bg-[#181a1b] rounded-3xl border-4 shadow-lg border-[#303436] flex items-center justify-center blueprint flex-col cursor-pointer hover:border-[#3b3e40] transform-gpu transition-all"
			@click="triggerFileInput"
		>
			<IconUpload class="h-12 w-12 pointer-events-none" />
			<h3 class="font-bold text-center mt-4 pointer-events-none">
				DROP FILES OR <br /><span class="text-blue-400">CLICK HERE</span>
			</h3>
			<p class="text-center mt-4 w-3/4 pointer-events-none">
				Drag and drop your files here. {{ formatBytes(maxFileSize) }} max per file.
			</p>

			<input ref="inputUpload" type="file" class="hidden" multiple @change="onFileChanged($event)" />
		</div>
		<AlbumDropdown v-if="isLoggedIn" class="absolute -bottom-12 w-full" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useUserStore, useUploadsStore, useSettingsStore, useAlbumsStore } from '~/store';
import { getFileExtension, formatBytes } from '~/use/file';
import { debug } from '~/use/log';
import { chibiUploader } from '@chibisafe/uploader-client';
import AlbumDropdown from '~/components/dropdown/AlbumDropdown.vue';
// import { chibiUploader } from '../../../../../chibisafe-uploader/packages/uploader-client/lib';

// @ts-ignore
import IconUpload from '~icons/carbon/cloud-upload';

const userStore = useUserStore();
const uploadsStore = useUploadsStore();
const settingsStore = useSettingsStore();
const albumsStore = useAlbumsStore();
const isLoggedIn = computed(() => userStore.user.loggedIn);
const token = computed(() => userStore.user.token);
const files = ref<File[] | null>();
const inputUpload = ref<HTMLInputElement>();

const maxFileSize = computed(() => settingsStore.maxFileSize);
const chunkSize = computed(() => settingsStore.chunkSize);

const triggerFileInput = () => {
	inputUpload.value?.click();
};

const pasteHandler = (event: ClipboardEvent) => {
	if (!event.clipboardData) return;
	for (const file of Array.from(event.clipboardData.files)) {
		if (!file?.type) continue;

		const fileData = new File([file], `pasted-file.${getFileExtension(file)}`, {
			type: file.type
		});

		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		void processFile(fileData);
	}
};

const processFile = async (file: File) => {
	files.value?.push(file);
	await chibiUploader({
		// @ts-ignore
		debug: !import.meta.env.PROD,
		endpoint: '/api/upload',
		file,
		maxFileSize: maxFileSize.value,
		chunkSize: chunkSize.value,
		postParams: {
			name: file.name,
			type: file.type,
			// @ts-ignore
			size: file.size
		},
		headers: {
			authorization: token.value ? `Bearer ${token.value}` : '',
			albumuuid: isLoggedIn.value
				? albumsStore.selectedAlbumForUpload
					? albumsStore.selectedAlbumForUpload
					: ''
				: ''
		},
		onStart: (uuid: string, totalChunks: number) => {
			debug(`Started uploading ${file.name} with uuid ${uuid} and ${totalChunks} chunks`);
			uploadsStore.addFile({
				uuid,
				name: file.name,
				type: file.type,
				processing: true,
				status: 'uploading',
				bytesSent: 0,
				bytesTotal: file.size,
				progress: 0,
				url: ''
			});
		},
		onError: (uuid: string, error: any) => {
			debug(`Error uploading ${file.name} with uuid ${uuid}`, error.message);
			uploadsStore.setError(uuid, error.message);
		},
		onProgress: (uuid: string, progress: any) => {
			uploadsStore.updateProgess(uuid, progress, 0);
		},
		onRetry: (uuid: string, reason: any) => {
			console.log('onRetry', reason);
		},
		onFinish: (uuid: string, response: any) => {
			debug('Finished uploading file', {
				name: file.name,
				uuid,
				url: response.url
			});
			uploadsStore.setCompleted(uuid, response.url);
		}
	});
};

const onFileChanged = ($event: Event) => {
	const target = $event.target as HTMLInputElement;
	if (target?.files) {
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i = 0; i < target.files.length; i++) {
			void processFile(target.files[i]);
		}
	}
};

onMounted(() => {
	// @ts-ignore
	window.addEventListener('paste', pasteHandler);
});

onUnmounted(() => {
	// @ts-ignore
	window.removeEventListener('paste', pasteHandler);
});
</script>
